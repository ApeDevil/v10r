import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	collectUnsavedWork,
	countUnsavedWork,
	DRAIN_TIMEOUT_MS,
	discardUnsavedWork,
	drainUnsavedWork,
	signOutVerdict,
	type UnsavedWork,
} from './unsaved-work';

/** A source holding `remaining` items until its drain (optionally gated by `drain`) delivers them. */
function work(remaining: number, drain: () => Promise<void> = async () => {}) {
	let left = remaining;
	return {
		drain: vi.fn(async () => {
			await drain();
			left = 0;
		}),
		count: () => left,
		discard: vi.fn(),
	};
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('drainUnsavedWork', () => {
	it('returns 0 once every source delivered its work', async () => {
		const sources = [work(2), work(1)];
		await expect(drainUnsavedWork(sources)).resolves.toBe(0);
		for (const source of sources) expect(source.drain).toHaveBeenCalledOnce();
	});

	it('stops waiting at the deadline and reports what is still unsaved', async () => {
		const stuck = work(2, () => new Promise(() => {}));
		const result = drainUnsavedWork([stuck, work(1)], 500);
		await vi.advanceTimersByTimeAsync(499);
		let settled = false;
		void result.then(() => {
			settled = true;
		});
		await Promise.resolve();
		expect(settled).toBe(false);
		await vi.advanceTimersByTimeAsync(1);
		await expect(result).resolves.toBe(2);
	});

	it('counts a failed drain as still unsaved instead of throwing', async () => {
		const failing: UnsavedWork = {
			drain: () => {
				throw new Error('sync throw');
			},
			count: () => 1,
			discard: () => {},
		};
		await expect(drainUnsavedWork([failing])).resolves.toBe(1);
	});

	it('defaults to a bounded wait', () => {
		expect(DRAIN_TIMEOUT_MS).toBeGreaterThan(0);
		expect(DRAIN_TIMEOUT_MS).toBeLessThanOrEqual(5000);
	});
});

describe('signOutVerdict', () => {
	it('proceeds when nothing is unsaved', () => {
		expect(signOutVerdict(0, 0)).toBe('proceed');
	});

	it('asks again when unsaved work appeared after the dialog opened', () => {
		expect(signOutVerdict(1, 0)).toBe('confirm');
		expect(signOutVerdict(3, 2)).toBe('confirm');
	});

	it('proceeds once the user has seen at least what is unsaved now', () => {
		expect(signOutVerdict(2, 2)).toBe('proceed');
		expect(signOutVerdict(1, 2)).toBe('proceed');
	});
});

describe('collect, count, discard', () => {
	it('skips a source that fails to load', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const ok = work(1);
		const collected = await collectUnsavedWork('u', [
			async () => ok,
			async () => Promise.reject(new Error('chunk 404')),
		]);
		expect(collected).toEqual([ok]);
		expect(countUnsavedWork(collected)).toBe(1);
	});

	it('discards every source even when one throws', () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const broken = work(1);
		broken.discard.mockImplementation(() => {
			throw new Error('storage gone');
		});
		const fine = work(1);
		discardUnsavedWork([broken, fine]);
		expect(fine.discard).toHaveBeenCalledOnce();
	});
});
