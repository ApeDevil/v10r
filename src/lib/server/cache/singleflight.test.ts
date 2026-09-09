import { beforeEach, describe, expect, it, vi } from 'vitest';
import { claimRefresh, coalesce, inFlightCount } from './singleflight';

vi.mock('./client', () => ({ redis: null }));

describe('coalesce', () => {
	beforeEach(() => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	it('collapses a burst of callers into ONE execution', async () => {
		let rebuilds = 0;
		const work = async () => {
			rebuilds++;
			await new Promise((r) => setTimeout(r, 10));
			return 'value';
		};

		// The whole point of the pattern: 100 simultaneous misses, one upstream rebuild.
		const results = await Promise.all(Array.from({ length: 100 }, () => coalesce('report', work)));

		expect(rebuilds).toBe(1);
		expect(results).toHaveLength(100);
		expect(new Set(results)).toEqual(new Set(['value']));
	});

	it('gives followers the leader rejection rather than a different answer', async () => {
		let attempts = 0;
		const failing = async () => {
			attempts++;
			await new Promise((r) => setTimeout(r, 5));
			throw new Error('upstream down');
		};

		const settled = await Promise.allSettled([coalesce('k', failing), coalesce('k', failing)]);

		expect(attempts).toBe(1);
		expect(settled.every((s) => s.status === 'rejected')).toBe(true);
	});

	it('deduplicates rather than memoizes — a later call runs again', async () => {
		let runs = 0;
		const work = async () => ++runs;

		await coalesce('k', work);
		await coalesce('k', work);

		expect(runs).toBe(2);
		expect(inFlightCount()).toBe(0);
	});

	it('keeps separate keys separate', async () => {
		const slow = (label: string) => async () => {
			await new Promise((r) => setTimeout(r, 5));
			return label;
		};

		const [a, b] = await Promise.all([coalesce('a', slow('a')), coalesce('b', slow('b'))]);

		expect([a, b]).toEqual(['a', 'b']);
	});

	it('releases the key even when the work throws synchronously', async () => {
		await expect(
			coalesce('boom', () => {
				throw new Error('sync');
			}),
		).rejects.toThrow('sync');

		// A leaked entry would deadlock this key for the life of the process.
		expect(inFlightCount()).toBe(0);
	});
});

describe('claimRefresh without Redis', () => {
	it('lets every caller refresh — there is no shared state to coordinate through', async () => {
		await expect(claimRefresh('k')).resolves.toBe(true);
	});
});
