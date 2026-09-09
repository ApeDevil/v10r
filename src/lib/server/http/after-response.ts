/**
 * After-response work — the deferred tail of a request.
 *
 * Only work the caller's immediate intent depends on belongs before the response.
 * Analytics, search indexing, outbox routing, telemetry rows and notification
 * fan-out are all *consequences* of the answer, not part of it, and every
 * millisecond they spend on the critical path is a millisecond the user waits for
 * nothing they asked for.
 *
 * Two platform facts make this a function rather than a convention:
 *
 *   Vercel FREEZES the execution environment the moment a response returns. A bare
 *   un-awaited promise there is not merely unordered, it is not guaranteed to run at
 *   all — documented behaviour, not a race. `waitUntil` keeps it alive; off Vercel
 *   (container, tests) it degrades to plain fire-and-forget, which is correct there.
 *
 *   An unhandled rejection can take the serverless process down (SvelteKit #9785), so
 *   the `.catch` must be attached BEFORE the promise is handed over — not inside the
 *   work, not afterwards. Six call sites each restated that rule in a comment; one of
 *   them getting it wrong is invisible until a provider has an outage.
 *
 * Deferred failures are logged, never rethrown: the response has already been sent
 * and there is no one left to tell. Because delivery is best-effort and the platform
 * may retry the request that spawned it, deferred work must be idempotent.
 *
 * This is NOT `defer.ts`. That one keeps a *streaming* promise alive inside a
 * response body; this one runs work after the response is finished. Two lifetimes,
 * two files.
 */
import { waitUntil } from '@vercel/functions';

/**
 * Run `work` after the response, outside the caller's wait.
 *
 * `label` names the work in the failure log — it is what someone reads at 3am, so
 * name the effect (`analytics:pageview`), not the mechanism (`insert`).
 *
 * Returns nothing on purpose: a caller that wants the result wanted it on the
 * critical path.
 */
export function deferAfterResponse(label: string, work: () => Promise<unknown>): void {
	let promise: Promise<unknown>;
	try {
		promise = work();
	} catch (err) {
		// A synchronous throw before the first await never becomes a promise, so the
		// .catch below would never see it.
		console.error(`[after-response] ${label} threw before deferral:`, err);
		return;
	}
	waitUntil(promise.catch((err) => console.error(`[after-response] ${label} failed:`, err)));
}
