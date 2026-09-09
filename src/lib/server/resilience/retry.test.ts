import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeadlineExceededError, startDeadline } from '$lib/server/http/deadline';
import { ResilienceError } from './errors';
import { retryWithin } from './retry';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const policy = { attempts: 3, baseDelayMs: 1, maxDelayMs: 4 };

afterEach(() => vi.restoreAllMocks());

describe('retryWithin', () => {
	it('returns the first success without retrying', async () => {
		const work = vi.fn(async () => 'ok');
		await expect(retryWithin(startDeadline(1000), policy, work)).resolves.toBe('ok');
		expect(work).toHaveBeenCalledTimes(1);
	});

	it('retries a failure and returns the eventual success', async () => {
		let attempts = 0;
		const result = await retryWithin(startDeadline(1000), policy, async () => {
			attempts++;
			if (attempts < 3) throw new Error('flaky');
			return 'recovered';
		});

		expect(result).toBe('recovered');
		expect(attempts).toBe(3);
	});

	it('gives up after the configured attempts and rethrows the last failure', async () => {
		const work = vi.fn(async () => {
			throw new Error('always down');
		});

		await expect(retryWithin(startDeadline(1000), policy, work)).rejects.toThrow('always down');
		expect(work).toHaveBeenCalledTimes(3);
	});

	it('passes the attempt index so a caller can log or vary by attempt', async () => {
		const seen: number[] = [];
		await retryWithin(startDeadline(1000), policy, async (_signal, attempt) => {
			seen.push(attempt);
			if (attempt < 2) throw new Error('again');
			return 'ok';
		});

		expect(seen).toEqual([0, 1, 2]);
	});
});

describe('the budget', () => {
	// The rule that makes retry-plus-timeout composable instead of multiplicative:
	// three attempts do not buy three budgets.
	it('spends one budget across every attempt', async () => {
		const deadline = startDeadline(100);
		// Far longer than the budget, but not so long that the timer outlives the test —
		// a pending multi-second timer at teardown is how a vitest worker exits unexpectedly.
		const work = vi.fn(async () => {
			await sleep(600);
			return 'never';
		});

		const started = performance.now();
		await expect(
			retryWithin(deadline, { attempts: 3, baseDelayMs: 1, maxDelayMs: 2, attemptMaxMs: 40 }, work),
		).rejects.toBeInstanceOf(DeadlineExceededError);

		// 40 + 40 + a third attempt clamped to what is left = the 100ms budget, not three
		// fresh 40ms windows and certainly not three 5-second calls. The whole operation
		// is bounded by the number the caller stated.
		expect(deadline.expired()).toBe(true);
		expect(performance.now() - started).toBeLessThan(1000);
		expect(work.mock.calls.length).toBeLessThanOrEqual(3);
	});

	it('stops attempting once the budget is gone', async () => {
		const deadline = startDeadline(30);
		await sleep(60);
		const work = vi.fn(async () => 'never');

		await expect(retryWithin(deadline, policy, work)).rejects.toBeInstanceOf(DeadlineExceededError);
		expect(work).not.toHaveBeenCalled();
	});

	it('does not sleep past the deadline to reach an attempt it cannot make', async () => {
		const deadline = startDeadline(40);
		const work = vi.fn(async () => {
			throw new Error('down');
		});

		await expect(retryWithin(deadline, { attempts: 5, baseDelayMs: 10_000, maxDelayMs: 60_000 }, work)).rejects.toThrow(
			'down',
		);
		// One attempt, then a backoff longer than the whole budget — waiting for it would
		// be a slower way to arrive at the same failure.
		expect(work).toHaveBeenCalledTimes(1);
	});

	it('bounds a single attempt when attemptMaxMs is set', async () => {
		const work = vi.fn(async () => {
			await sleep(500);
			return 'never';
		});

		await expect(
			retryWithin(startDeadline(1000), { attempts: 2, baseDelayMs: 1, maxDelayMs: 2, attemptMaxMs: 30 }, work),
		).rejects.toBeInstanceOf(DeadlineExceededError);
		// Bounded per attempt, so the second attempt was actually reachable.
		expect(work).toHaveBeenCalledTimes(2);
	});
});

describe('backoff', () => {
	// Full jitter is the point of the backoff, not a refinement of it: clients that
	// failed together retry together unless something spreads them.
	it('draws each delay from [0, capped) rather than using the cap', async () => {
		const delays: number[] = [];
		// Driven to both extremes rather than sampled, so the spread is asserted and not
		// observed — a statistical version of this test fails a few percent of the time.
		for (const roll of [0, 0.999]) {
			vi.spyOn(Math, 'random').mockReturnValue(roll);
			delays.length = 0;
			await retryWithin(
				startDeadline(1000),
				{ attempts: 2, baseDelayMs: 100, maxDelayMs: 100 },
				async () => {
					throw new Error('down');
				},
				{ onRetry: (_attempt, delayMs) => delays.push(delayMs) },
			).catch(() => {});
			expect(delays[0]).toBeCloseTo(roll * 100, 5);
		}
	});

	it('doubles the cap per attempt, up to maxDelayMs', async () => {
		vi.spyOn(Math, 'random').mockReturnValue(0.999);
		const delays: number[] = [];

		await retryWithin(
			startDeadline(2000),
			{ attempts: 4, baseDelayMs: 10, maxDelayMs: 25 },
			async () => {
				throw new Error('down');
			},
			{ onRetry: (_attempt, delayMs) => delays.push(delayMs) },
		).catch(() => {});

		// 10 → 20 → capped at 25, all scaled by the jitter roll.
		expect(delays.map((d) => Math.round(d))).toEqual([10, 20, 25]);
	});
});

describe('what is not worth repeating', () => {
	it('does not retry a breaker or bulkhead refusal', async () => {
		const work = vi.fn(async () => {
			throw new ResilienceError('breaker_open', 'cooling off');
		});

		await expect(retryWithin(startDeadline(1000), policy, work)).rejects.toBeInstanceOf(ResilienceError);
		// The system already decided not to try. Asking again spends budget for the same answer.
		expect(work).toHaveBeenCalledTimes(1);
	});

	it('honours a caller that declares its own retryable set', async () => {
		const work = vi.fn(async () => {
			throw new Error('400 bad request');
		});

		await expect(
			retryWithin(startDeadline(1000), policy, work, { retryable: (err) => !String(err).includes('400') }),
		).rejects.toThrow('400 bad request');
		expect(work).toHaveBeenCalledTimes(1);
	});
});
