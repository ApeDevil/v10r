import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deferAfterResponse } from '$lib/server/http/after-response';
import { readThrough } from './swr';
import { clearLocalCache, definePolicy } from './tiered';

vi.mock('./client', () => ({ redis: null }));
// Captured rather than executed, so a test can decide when the tail runs — which is
// also the property being asserted: the refresh must NOT be awaited by the caller.
vi.mock('$lib/server/http/after-response', () => ({ deferAfterResponse: vi.fn() }));

const deferred = vi.mocked(deferAfterResponse);
const runDeferred = async () => {
	for (const [, work] of deferred.mock.calls) await work();
};

const feed = definePolicy({ namespace: 'feed', ttl: 60, staleFor: 3600, scope: 'shared', jitter: 0 });

describe('readThrough', () => {
	beforeEach(() => {
		clearLocalCache();
		deferred.mockClear();
		vi.restoreAllMocks();
	});

	it('computes on a cold read and reports the origin tier', async () => {
		const read = await readThrough(feed, { id: 'latest' }, async () => 'v1');

		expect(read).toMatchObject({ value: 'v1', tier: 'origin', stale: false, ageSeconds: 0 });
	});

	it('serves the second read from cache without recomputing', async () => {
		const compute = vi.fn(async () => 'v1');

		await readThrough(feed, { id: 'latest' }, compute);
		const warm = await readThrough(feed, { id: 'latest' }, compute);

		expect(compute).toHaveBeenCalledTimes(1);
		expect(warm).toMatchObject({ value: 'v1', tier: 'local', stale: false });
	});

	it('rebuilds ONCE for a burst of cold concurrent readers', async () => {
		const compute = vi.fn(async () => {
			await new Promise((r) => setTimeout(r, 10));
			return 'v1';
		});

		await Promise.all(Array.from({ length: 50 }, () => readThrough(feed, { id: 'latest' }, compute)));

		expect(compute).toHaveBeenCalledTimes(1);
	});

	it('returns a stale value IMMEDIATELY and refreshes behind the response', async () => {
		let version = 1;
		const compute = vi.fn(async () => `v${version}`);

		await readThrough(feed, { id: 'latest' }, compute);
		version = 2;
		vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 120_000);

		const stale = await readThrough(feed, { id: 'latest' }, compute);

		// The caller got the old value without waiting for the new one.
		expect(stale).toMatchObject({ value: 'v1', stale: true });
		expect(compute).toHaveBeenCalledTimes(1);
		expect(deferred).toHaveBeenCalledTimes(1);
		expect(deferred.mock.calls[0][0]).toBe('cache:revalidate:feed');

		await runDeferred();
		expect(compute).toHaveBeenCalledTimes(2);
	});

	it('keeps serving stale when the refresh fails — stale beats a 500', async () => {
		const compute = vi
			.fn<() => Promise<string>>()
			.mockResolvedValueOnce('v1')
			.mockRejectedValue(new Error('origin down'));

		await readThrough(feed, { id: 'latest' }, compute);
		vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 120_000);

		const stale = await readThrough(feed, { id: 'latest' }, compute);
		await expect(runDeferred()).rejects.toThrow('origin down');

		expect(stale).toMatchObject({ value: 'v1', stale: true });
		// Still servable afterwards: the failed refresh did not evict anything.
		expect(await readThrough(feed, { id: 'latest' }, compute)).toMatchObject({ value: 'v1', stale: true });
	});

	it('throws on a cold read when the origin fails — nothing exists to serve', async () => {
		await expect(
			readThrough(feed, { id: 'absent' }, async () => {
				throw new Error('origin down');
			}),
		).rejects.toThrow('origin down');
	});

	it('never serves stale for a policy that did not opt into a stale window', async () => {
		const strict = definePolicy({ namespace: 'balance', ttl: 1, scope: 'shared', jitter: 0 });
		const compute = vi.fn(async () => 'fresh');

		await readThrough(strict, { id: 'total' }, compute);
		vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 5000);
		const second = await readThrough(strict, { id: 'total' }, compute);

		expect(second.stale).toBe(false);
		expect(second.tier).toBe('origin');
		expect(compute).toHaveBeenCalledTimes(2);
	});
});
