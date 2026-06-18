/**
 * The rate-limit factory's failure posture is a security contract:
 *  - dev + no Redis → passthrough (don't block local work)
 *  - prod + no Redis → fail CLOSED (deny rather than run unprotected)
 *  - prod + Redis throws at runtime → fail CLOSED (not a 500)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
});

async function loadWith(opts: { redis: unknown; dev: boolean; ratelimit?: unknown }) {
	vi.doMock('$lib/server/cache', () => ({ redis: opts.redis }));
	vi.doMock('$app/environment', () => ({ dev: opts.dev, building: false, browser: false }));
	if (opts.ratelimit) {
		vi.doMock('@upstash/ratelimit', () => ({ Ratelimit: opts.ratelimit }));
	}
	return import('./rate-limit');
}

describe('createLimiter failure posture', () => {
	it('passes through in dev when Redis is unavailable', async () => {
		const { createLimiter } = await loadWith({ redis: null, dev: true });
		const limiter = createLimiter('rl:test', 5, '1 m');
		expect(await limiter.limit('id')).toEqual({ success: true, reset: 0 });
	});

	it('fails CLOSED in prod when Redis is unavailable', async () => {
		const { createLimiter } = await loadWith({ redis: null, dev: false });
		const limiter = createLimiter('rl:test', 5, '1 m');
		const result = await limiter.limit('id');
		expect(result.success).toBe(false);
		expect(result.reset).toBeGreaterThan(Date.now());
	});

	it('fails CLOSED (not 500) when Redis throws at runtime', async () => {
		class ThrowingRatelimit {
			static slidingWindow() {
				return {};
			}
			limit() {
				return Promise.reject(new Error('ECONNREFUSED'));
			}
		}
		const { createLimiter } = await loadWith({ redis: {}, dev: false, ratelimit: ThrowingRatelimit });
		const limiter = createLimiter('rl:test', 5, '1 m');
		const result = await limiter.limit('id');
		expect(result.success).toBe(false);
		expect(result.reset).toBeGreaterThan(Date.now());
	});

	it('passes through the SDK result on success', async () => {
		class OkRatelimit {
			static slidingWindow() {
				return {};
			}
			limit() {
				return Promise.resolve({ success: true, reset: 123, limit: 5, remaining: 4 });
			}
		}
		const { createLimiter } = await loadWith({ redis: {}, dev: false, ratelimit: OkRatelimit });
		const limiter = createLimiter('rl:test', 5, '1 m');
		expect(await limiter.limit('id')).toEqual({ success: true, reset: 123 });
	});
});
