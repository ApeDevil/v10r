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

describe('createLimiter peek (read without consuming)', () => {
	it('reports open quota in dev when Redis is unavailable', async () => {
		const { createLimiter } = await loadWith({ redis: null, dev: true });
		const limiter = createLimiter('rl:test', 5, '1 m');
		expect(await limiter.peek('id')).toEqual({ remaining: Number.POSITIVE_INFINITY, reset: 0 });
	});

	it('reports exhausted quota in prod when Redis is unavailable', async () => {
		const { createLimiter } = await loadWith({ redis: null, dev: false });
		const limiter = createLimiter('rl:test', 5, '1 m');
		const result = await limiter.peek('id');
		expect(result.remaining).toBe(0);
		expect(result.reset).toBeGreaterThan(Date.now());
	});

	it('passes through the SDK result on success', async () => {
		class OkRatelimit {
			static slidingWindow() {
				return {};
			}
			getRemaining() {
				return Promise.resolve({ remaining: 4, reset: 123 });
			}
		}
		const { createLimiter } = await loadWith({ redis: {}, dev: false, ratelimit: OkRatelimit });
		const limiter = createLimiter('rl:test', 5, '1 m');
		expect(await limiter.peek('id')).toEqual({ remaining: 4, reset: 123 });
	});

	it('fails CLOSED when Redis throws at runtime', async () => {
		class ThrowingRatelimit {
			static slidingWindow() {
				return {};
			}
			getRemaining() {
				return Promise.reject(new Error('ECONNREFUSED'));
			}
		}
		const { createLimiter } = await loadWith({ redis: {}, dev: false, ratelimit: ThrowingRatelimit });
		const limiter = createLimiter('rl:test', 5, '1 m');
		const result = await limiter.peek('id');
		expect(result.remaining).toBe(0);
		expect(result.reset).toBeGreaterThan(Date.now());
	});

	it('fails OPEN when Redis hangs past the bounded timeout', async () => {
		vi.useFakeTimers();
		try {
			class HangingRatelimit {
				static slidingWindow() {
					return {};
				}
				getRemaining() {
					return new Promise(() => {});
				}
			}
			const { createLimiter } = await loadWith({ redis: {}, dev: false, ratelimit: HangingRatelimit });
			const limiter = createLimiter('rl:test', 5, '1 m');
			const pending = limiter.peek('id');
			await vi.advanceTimersByTimeAsync(1000);
			expect(await pending).toEqual({ remaining: 5, reset: 0 });
		} finally {
			vi.useRealTimers();
		}
	});
});

describe('isDocumentRequest', () => {
	async function load() {
		return loadWith({ redis: null, dev: true });
	}

	it('detects a top-level navigation via Sec-Fetch-Dest', async () => {
		const { isDocumentRequest } = await load();
		expect(isDocumentRequest(new Headers({ 'sec-fetch-dest': 'document' }))).toBe(true);
	});

	it('treats Sec-Fetch-Dest as authoritative over Accept', async () => {
		const { isDocumentRequest } = await load();
		expect(isDocumentRequest(new Headers({ 'sec-fetch-dest': 'empty', accept: 'text/html' }))).toBe(false);
		expect(isDocumentRequest(new Headers({ 'sec-fetch-dest': 'iframe', accept: 'text/html' }))).toBe(false);
	});

	it('falls back to Accept sniffing when Sec-Fetch-Dest is absent', async () => {
		const { isDocumentRequest } = await load();
		expect(isDocumentRequest(new Headers({ accept: 'text/html,application/xhtml+xml' }))).toBe(true);
		expect(isDocumentRequest(new Headers({ accept: 'application/json' }))).toBe(false);
	});

	it('defaults to non-document with no signal headers', async () => {
		const { isDocumentRequest } = await load();
		expect(isDocumentRequest(new Headers())).toBe(false);
	});
});
