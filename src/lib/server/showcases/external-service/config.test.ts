/**
 * The lab's limiter policy, run through the real `createLimiter` against a limiter store
 * that is slow, failing or absent. Every lab bucket — per-IP, global, and the wake check's
 * two — refuses in all three: they share one store, and they are the only cap on the lab's
 * outbound calls, and so on the free host's hours.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LAB_LIMITER_POLICY } from './config';

afterEach(() => {
	vi.useRealTimers();
	vi.resetModules();
	vi.clearAllMocks();
});

type Store = 'slow' | 'failing' | 'absent';

async function decide(store: Store) {
	vi.doMock('$lib/server/cache', () => ({ redis: store === 'absent' ? null : {} }));
	vi.doMock('$app/environment', () => ({ dev: false, building: false, browser: false }));
	vi.doMock('@upstash/ratelimit', () => ({
		Ratelimit: class {
			static slidingWindow() {
				return {};
			}
			limit() {
				return store === 'slow' ? new Promise(() => {}) : Promise.reject(new Error('ECONNREFUSED'));
			}
		},
	}));
	vi.spyOn(console, 'error').mockImplementation(() => {});
	const { createLimiter } = await import('$lib/server/http/rate-limit');
	const limiter = createLimiter('rl:test', 20, '60 s', LAB_LIMITER_POLICY);
	vi.useFakeTimers();
	const decision = limiter.limit('203.0.113.7');
	await vi.advanceTimersByTimeAsync(2_000);
	return (await decision).success;
}

describe('lab limiter policy', () => {
	it.each<Store>(['slow', 'failing', 'absent'])('a %s store refuses', async (store) => {
		expect(await decide(store)).toBe(false);
	});
});
