import { describe, expect, it, vi } from 'vitest';
import { startCancellation } from './cancellation';

/** A source of `chunks` that records whether the consumer cancelled it. */
function source(chunks: string[]) {
	const cancel = vi.fn();
	const stream = new ReadableStream<string>({
		start(controller) {
			for (const c of chunks) controller.enqueue(c);
			controller.close();
		},
		cancel,
	});
	return { stream, cancel };
}

async function drain<T>(stream: ReadableStream<T>): Promise<T[]> {
	const out: T[] = [];
	const reader = stream.getReader();
	for (let next = await reader.read(); !next.done; next = await reader.read()) out.push(next.value);
	return out;
}

describe('startCancellation', () => {
	it('passes every chunk through and stays quiet when the reader reads to the end', async () => {
		const cancellation = startCancellation();
		const { stream, cancel } = source(['a', 'b', 'c']);

		expect(await drain(cancellation.body(stream))).toEqual(['a', 'b', 'c']);
		expect(cancellation.signal.aborted).toBe(false);
		expect(cancel).not.toHaveBeenCalled();
	});

	it('aborts the signal with the reason when the body is cancelled, and cancels the source too', async () => {
		const cancellation = startCancellation();
		const { stream, cancel } = source(['a', 'b']);
		const body = cancellation.body(stream);
		const reader = body.getReader();
		expect((await reader.read()).value).toBe('a');

		const reason = new Error('socket closed');
		await reader.cancel(reason);

		expect(cancellation.signal.aborted).toBe(true);
		expect(cancellation.signal.reason).toBe(reason);
		expect(cancel).toHaveBeenCalledWith(reason);
	});

	it('cancellation propagates upstream through pipeThrough — the wrapper can sit before an encoder', async () => {
		const cancellation = startCancellation();
		const { stream } = source(['a', 'b']);
		const encoded = cancellation
			.body(stream)
			.pipeThrough(new TransformStream<string, string>({ transform: (c, ctrl) => ctrl.enqueue(c.toUpperCase()) }));

		const reader = encoded.getReader();
		expect((await reader.read()).value).toBe('A');
		await reader.cancel('gone');

		// The pipe abandons its source a task later, not on the cancel call itself.
		await vi.waitFor(() => expect(cancellation.signal.aborted).toBe(true));
	});

	it("is also aborted by the platform's request signal", () => {
		const request = new AbortController();
		const cancellation = startCancellation(request.signal);
		expect(cancellation.signal.aborted).toBe(false);

		request.abort();

		expect(cancellation.signal.aborted).toBe(true);
	});

	it('starts aborted when the request signal already is', () => {
		const request = new AbortController();
		request.abort();
		expect(startCancellation(request.signal).signal.aborted).toBe(true);
	});
});
