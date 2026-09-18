import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_REQUEST_BUDGET_MS, DeadlineExceededError, startDeadline } from './deadline';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('startDeadline', () => {
	it('reports a budget that only shrinks', async () => {
		const deadline = startDeadline(200);
		const first = deadline.remainingMs();
		await sleep(20);
		const second = deadline.remainingMs();

		expect(first).toBeLessThanOrEqual(200);
		expect(second).toBeLessThan(first);
		expect(deadline.budgetMs).toBe(200);
	});

	it('floors remaining at zero rather than going negative', async () => {
		const deadline = startDeadline(10);
		await sleep(40);
		expect(deadline.remainingMs()).toBe(0);
		expect(deadline.expired()).toBe(true);
	});

	it('treats a zero budget as already expired', () => {
		expect(startDeadline(0).expired()).toBe(true);
	});

	it('defaults to the documented request budget', () => {
		expect(startDeadline().budgetMs).toBe(DEFAULT_REQUEST_BUDGET_MS);
	});
});

describe('child', () => {
	it('grants what was asked for when the parent has room', () => {
		const child = startDeadline(1000).child(100);
		expect(child.budgetMs).toBeGreaterThan(90);
		expect(child.budgetMs).toBeLessThanOrEqual(100);
	});

	// The rule the whole pattern rests on: a child cannot outlive its parent, no
	// matter how large a window it asks for.
	it('clamps a child to the parent regardless of what it requests', () => {
		const parent = startDeadline(50);
		const child = parent.child(30_000);
		expect(child.budgetMs).toBeLessThanOrEqual(50);
	});

	it('holds back the reserve for work that follows the child', () => {
		const parent = startDeadline(1000);
		const child = parent.child(900, { reserveMs: 400 });
		// 1000 remaining − 400 reserved = 600 available, under the 900 requested.
		expect(child.budgetMs).toBeLessThanOrEqual(600);
		expect(child.budgetMs).toBeGreaterThan(550);
	});

	it('gives an expired parent a zero-budget child', async () => {
		const parent = startDeadline(10);
		await sleep(40);
		expect(parent.child(500).expired()).toBe(true);
	});

	it('gives a zero-budget child when the reserve exceeds what is left', () => {
		expect(startDeadline(100).child(100, { reserveMs: 500 }).budgetMs).toBe(0);
	});
});

describe('run', () => {
	it('returns the result when the work finishes inside the budget', async () => {
		await expect(startDeadline(500).run(async () => 'done')).resolves.toBe('done');
	});

	it('rejects with DeadlineExceededError when the work outlasts the budget', async () => {
		await expect(startDeadline(30).run(() => sleep(500))).rejects.toBeInstanceOf(DeadlineExceededError);
	});

	it('refuses to start work with no budget left', async () => {
		const deadline = startDeadline(10);
		await sleep(40);
		const work = vi.fn(async () => 'never');

		await expect(deadline.run(work)).rejects.toBeInstanceOf(DeadlineExceededError);
		// The point of a deadline is not paying for a result nobody can use.
		expect(work).not.toHaveBeenCalled();
	});

	it('mints its signal with whole milliseconds, rounded up', () => {
		// Bun accepts a fractional timeout; Node throws RangeError. `performance.now()` is
		// fractional, so only an integer argument keeps the gate honest on either engine.
		const timeout = vi.spyOn(AbortSignal, 'timeout');
		try {
			startDeadline(2_000).signal();
			const [ms] = timeout.mock.calls[0] ?? [];
			expect(Number.isInteger(ms)).toBe(true);
			expect(ms).toBeGreaterThanOrEqual(1_999);
			expect(ms).toBeLessThanOrEqual(2_000);
		} finally {
			timeout.mockRestore();
		}
	});

	it('aborts the signal it handed the work', async () => {
		let observed: AbortSignal | undefined;
		await expect(
			startDeadline(30).run((signal) => {
				observed = signal;
				return sleep(500);
			}),
		).rejects.toBeInstanceOf(DeadlineExceededError);

		expect(observed?.aborted).toBe(true);
		expect(observed?.reason).toBeInstanceOf(DeadlineExceededError);
	});

	// Abandoned work keeps running and may reject long after nobody is listening. On
	// Vercel an unhandled rejection can take the process down (SvelteKit #9785), so the
	// `.catch` has to be attached before the race, not after it.
	it('does not leave the abandoned work as an unhandled rejection', async () => {
		const unhandled = vi.fn();
		process.on('unhandledRejection', unhandled);
		try {
			await expect(
				startDeadline(20).run(async () => {
					await sleep(60);
					throw new Error('the abandoned work failed after the deadline');
				}),
			).rejects.toBeInstanceOf(DeadlineExceededError);

			// Past the work's own rejection, plus a turn for the runtime to report it.
			await sleep(120);
			expect(unhandled).not.toHaveBeenCalled();
		} finally {
			process.off('unhandledRejection', unhandled);
		}
	});

	it('is not cancellation: work that ignores the signal still completes', async () => {
		const finished = vi.fn();
		const stubborn = startDeadline(20).run(async () => {
			await sleep(80);
			finished();
		});

		await expect(stubborn).rejects.toBeInstanceOf(DeadlineExceededError);
		expect(finished).not.toHaveBeenCalled();
		await sleep(120);
		// It ran to completion behind the rejection — the deadline bounded the WAIT.
		expect(finished).toHaveBeenCalled();
	});
});

describe('DeadlineExceededError', () => {
	it('maps to 504 — out of time, not broken', () => {
		expect(new DeadlineExceededError('x').toStatus()).toBe(504);
	});
});
