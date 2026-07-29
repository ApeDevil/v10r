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

	it('still accepts the bare TimeoutPolicy string form', async () => {
		const { createLimiter } = await loadWith({ redis: null, dev: false });
		const limiter = createLimiter('rl:test', 5, '1 m', 'closed');
		expect((await limiter.limit('id')).success).toBe(false);
	});
});

/**
 * `onError` governs UNAVAILABLE, not SLOW. The distinction matters most at the
 * boot branch: a missing UPSTASH_* in prod returns the fail-closed singleton
 * before any per-call wrapper runs, so a limiter guarding deferred best-effort
 * work would deny 100% of it, permanently, after one log line at module load.
 */
describe('createLimiter onError policy', () => {
	it('defaults to closed, so existing call sites are unchanged', async () => {
		const { createLimiter } = await loadWith({ redis: null, dev: false });
		expect((await createLimiter('rl:test', 5, '1 m', {}).limit('id')).success).toBe(false);
	});

	it('passes through at BOOT when Redis is unconfigured and onError is open', async () => {
		// The branch that actually fires in production misconfiguration. Patching
		// only the runtime catch would leave this returning failClosed forever.
		const { createLimiter } = await loadWith({ redis: null, dev: false });
		const limiter = createLimiter('rl:test', 5, '1 m', { onError: 'open' });
		expect(await limiter.limit('id')).toEqual({ success: true, reset: 0 });
		expect(await limiter.peek('id')).toEqual({ remaining: Number.POSITIVE_INFINITY, reset: 0 });
	});

	it('passes through at RUNTIME when Redis throws and onError is open', async () => {
		class ThrowingRatelimit {
			static slidingWindow() {
				return {};
			}
			limit() {
				return Promise.reject(new Error('ECONNREFUSED'));
			}
			getRemaining() {
				return Promise.reject(new Error('ECONNREFUSED'));
			}
		}
		const { createLimiter } = await loadWith({ redis: {}, dev: false, ratelimit: ThrowingRatelimit });
		const limiter = createLimiter('rl:test', 5, '1 m', { onError: 'open' });
		expect(await limiter.limit('id')).toEqual({ success: true, reset: 0 });
		expect(await limiter.peek('id')).toEqual({ remaining: 5, reset: 0 });
	});

	it('keeps onError and onTimeout independent', async () => {
		vi.useFakeTimers();
		try {
			class HangingRatelimit {
				static slidingWindow() {
					return {};
				}
				limit() {
					return new Promise(() => {});
				}
			}
			const { createLimiter } = await loadWith({ redis: {}, dev: false, ratelimit: HangingRatelimit });
			// Unavailable → allow; slow → deny. Neither policy implies the other.
			const limiter = createLimiter('rl:test', 5, '1 m', { onError: 'open', onTimeout: 'closed' });
			const pending = limiter.limit('id');
			await vi.advanceTimersByTimeAsync(1000);
			expect((await pending).success).toBe(false);
		} finally {
			vi.useRealTimers();
		}
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
