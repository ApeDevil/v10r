/**
 * Client disconnect as an `AbortSignal`.
 *
 * A streaming response outlives the request that started it: the body was read long before
 * the first frame, so by the time the user hits Stop or closes the tab there is nothing left
 * of the request to fail. Two doors report the disconnect, and no platform opens both:
 *
 * - `request.signal` — aborted by the platform when it knows the client left. Vercel does so
 *   only for a function deployed with `supportsCancellation`; the Node bridge (dev server,
 *   adapter-node) aborts it only for a request whose BODY was interrupted.
 * - the response body's `cancel()` — what the Node bridge calls when the socket closes, and
 *   the door the SSE routes (`api/notifications/stream`) already rely on.
 *
 * `startCancellation` joins them into one signal for the work behind the response (a model
 * call, a subscription), so a turn nobody is listening to stops instead of running to its
 * timeout and charging for an answer no one will read. What to do at that moment — persist
 * what streamed, charge what usage reports — is the caller's, exactly as with a `Deadline`.
 *
 * Where each door is open (probed 2026-09-11): on Node 22 `ServerResponse` emits `close` the
 * moment the socket drops and the bridge cancels the body. Under Bun 1.3 — the dev container —
 * `node:http` never emits that `close` (and `res.write` keeps returning true), so the body is
 * never cancelled and a Stop in dev reaches only the client. Vercel's bridge is unverified.
 */

export interface Cancellation {
	/** Aborted once the client has stopped listening. */
	readonly signal: AbortSignal;
	/**
	 * The body to respond with: the same chunks, and cancelling it aborts `signal`. Cancellation
	 * still reaches the wrapped stream, so nothing upstream keeps pulling for a reader that left.
	 */
	body<T>(stream: ReadableStream<T>): ReadableStream<T>;
}

/** One per response. `requestSignal` is the platform's door; the body wrapper is the other. */
export function startCancellation(requestSignal?: AbortSignal): Cancellation {
	const disconnect = new AbortController();
	const signal = requestSignal ? AbortSignal.any([requestSignal, disconnect.signal]) : disconnect.signal;

	return {
		signal,
		body<T>(stream: ReadableStream<T>): ReadableStream<T> {
			const reader = stream.getReader();
			return new ReadableStream<T>({
				async pull(controller) {
					const { done, value } = await reader.read();
					if (done) controller.close();
					else controller.enqueue(value);
				},
				cancel(reason) {
					disconnect.abort(reason);
					return reader.cancel(reason);
				},
			});
		},
	};
}
