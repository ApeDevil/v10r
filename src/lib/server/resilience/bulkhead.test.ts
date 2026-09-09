import { describe, expect, it, vi } from 'vitest';
import { defineBulkhead } from './bulkhead';
import { ResilienceError } from './errors';

/** A promise the test resolves by hand, so concurrency is asserted rather than timed. */
function gate() {
	let open!: () => void;
	const opened = new Promise<void>((resolve) => {
		open = resolve;
	});
	return { open, opened };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('defineBulkhead', () => {
	it('runs work and returns its result', async () => {
		const bulkhead = defineBulkhead({ name: 'test', maxConcurrent: 2, maxQueued: 2 });
		await expect(bulkhead.run(async () => 'value')).resolves.toBe('value');
		expect(bulkhead.active).toBe(0);
	});

	it('holds concurrency at the compartment limit', async () => {
		const bulkhead = defineBulkhead({ name: 'test', maxConcurrent: 2, maxQueued: 5 });
		const held = gate();
		let peak = 0;

		const calls = Array.from({ length: 5 }, () =>
			bulkhead.run(async () => {
				peak = Math.max(peak, bulkhead.active);
				await held.opened;
			}),
		);

		await flush();
		expect(bulkhead.active).toBe(2);
		expect(bulkhead.queued).toBe(3);

		held.open();
		await Promise.all(calls);
		expect(peak).toBe(2);
		expect(bulkhead.active).toBe(0);
		expect(bulkhead.queued).toBe(0);
	});

	// The whole point: refuse, do not accumulate. An unbounded queue is latency the
	// caller cannot see and a slower way to run out of memory.
	it('refuses rather than queueing past the queue limit', async () => {
		const bulkhead = defineBulkhead({ name: 'test', maxConcurrent: 1, maxQueued: 1 });
		const held = gate();

		const running = bulkhead.run(() => held.opened);
		const queued = bulkhead.run(() => held.opened);
		await flush();

		await expect(bulkhead.run(async () => 'third')).rejects.toBeInstanceOf(ResilienceError);
		held.open();
		await Promise.all([running, queued]);
	});

	it('refuses with a 503 — declining work, not failing at it', async () => {
		const bulkhead = defineBulkhead({ name: 'test', maxConcurrent: 1, maxQueued: 0 });
		const held = gate();
		const running = bulkhead.run(() => held.opened);
		await flush();

		const refusal = await bulkhead.run(async () => 'x').catch((err) => err);
		expect(refusal).toBeInstanceOf(ResilienceError);
		expect(refusal.kind).toBe('bulkhead_full');
		expect(refusal.toStatus()).toBe(503);

		held.open();
		await running;
	});

	it('releases the slot when the work throws', async () => {
		const bulkhead = defineBulkhead({ name: 'test', maxConcurrent: 1, maxQueued: 0 });

		await expect(
			bulkhead.run(async () => {
				throw new Error('dependency failed');
			}),
		).rejects.toThrow('dependency failed');

		expect(bulkhead.active).toBe(0);
		await expect(bulkhead.run(async () => 'next')).resolves.toBe('next');
	});

	it('hands a released slot to the waiter, not to a newcomer', async () => {
		const bulkhead = defineBulkhead({ name: 'test', maxConcurrent: 1, maxQueued: 2 });
		const first = gate();
		const order: string[] = [];

		const running = bulkhead.run(async () => {
			order.push('first');
			await first.opened;
		});
		await flush();
		const waiting = bulkhead.run(async () => {
			order.push('second');
		});
		await flush();

		first.open();
		await Promise.all([running, waiting]);
		expect(order).toEqual(['first', 'second']);
	});

	it('reports load rising before it starts refusing', async () => {
		const bulkhead = defineBulkhead({ name: 'test', maxConcurrent: 2, maxQueued: 2 });
		const held = gate();
		expect(bulkhead.load).toBe(0);

		const calls = [bulkhead.run(() => held.opened), bulkhead.run(() => held.opened)];
		await flush();

		// Two of four slots taken, and nothing refused yet — which is exactly the window
		// in which shedding optional work is still cheap.
		expect(bulkhead.load).toBe(0.5);
		held.open();
		await Promise.all(calls);
	});

	it('treats a nonsensical limit as one slot rather than none', async () => {
		const bulkhead = defineBulkhead({ name: 'test', maxConcurrent: 0, maxQueued: 0 });
		await expect(bulkhead.run(async () => 'still runs')).resolves.toBe('still runs');
	});

	it('does not lose a slot when a queued caller is admitted', async () => {
		const bulkhead = defineBulkhead({ name: 'test', maxConcurrent: 1, maxQueued: 3 });
		const seen: number[] = [];
		const held = gate();

		const calls = Array.from({ length: 4 }, (_, i) =>
			bulkhead.run(async () => {
				seen.push(i);
				if (i === 0) await held.opened;
			}),
		);
		await flush();
		held.open();
		await Promise.all(calls);

		expect(seen).toEqual([0, 1, 2, 3]);
		expect(bulkhead.active).toBe(0);
	});
});

describe('composition', () => {
	it('surfaces the refusal to the caller instead of swallowing it', async () => {
		const bulkhead = defineBulkhead({ name: 'test', maxConcurrent: 1, maxQueued: 0 });
		const held = gate();
		const running = bulkhead.run(() => held.opened);
		await flush();

		const work = vi.fn(async () => 'never ran');
		await expect(bulkhead.run(work)).rejects.toBeInstanceOf(ResilienceError);
		expect(work).not.toHaveBeenCalled();

		held.open();
		await running;
	});
});
