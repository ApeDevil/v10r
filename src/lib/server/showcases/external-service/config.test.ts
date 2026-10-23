/**
 * The lab's two limiter policies, run through the real `createLimiter` against a limiter
 * store that is slow, failing or absent. The per-IP bucket gives way only to a SLOW store;
 * the global bucket — the cap on outbound calls, and so on the free host's hours — never
 * gives way.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GLOBAL_RATE_LIMIT_POLICY, RATE_LIMIT_POLICY } from './config';

afterEach(() => {
	vi.useRealTimers();
	vi.resetModules();
	vi.clearAllMocks();
});

type Store = 'slow' | 'failing' | 'absent';

async function limiterWith(store: Store, policy: typeof RATE_LIMIT_POLICY | typeof GLOBAL_RATE_LIMIT_POLICY) {
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
	return createLimiter('rl:test', 20, '60 s', policy);
}

async function decide(store: Store, policy: typeof RATE_LIMIT_POLICY | typeof GLOBAL_RATE_LIMIT_POLICY) {
	const limiter = await limiterWith(store, policy);
	vi.useFakeTimers();
	const decision = limiter.limit('203.0.113.7');
	await vi.advanceTimersByTimeAsync(2_000);
	return (await decision).success;
}

describe('lab limiter policies', () => {
	it.each<[Store, boolean, boolean]>([
		// store       per-IP  global
		['slow', true, false],
		['failing', false, false],
		['absent', false, false],
	])('%s store → per-IP allows: %s, global allows: %s', async (store, perIp, global) => {
		expect(await decide(store, RATE_LIMIT_POLICY)).toBe(perIp);
		vi.useRealTimers();
		vi.resetModules();
		expect(await decide(store, GLOBAL_RATE_LIMIT_POLICY)).toBe(global);
	});
});
