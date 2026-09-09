import { describe, expect, it, vi } from 'vitest';

/**
 * The gate every cron entry point runs before it does any work.
 *
 * Two properties matter and neither is visible from the endpoint that calls it:
 *
 *  1. **The bucket is consulted BEFORE the secret compare.** A shared secret with no
 *     limiter in front of it is an unbounded guessing surface. Asserting the order means
 *     asserting that a throttled request never reaches the compare at all.
 *  2. **A missing `CRON_SECRET` is a 401, never a fall-through.** The secret is passed in
 *     rather than read here, so `undefined` is reachable — an env var absent in one
 *     environment must not open the endpoint.
 *
 * The limiter is mocked because it is the seam being ordered against; `rate-limit.test.ts`
 * covers the real limiter's own fail-closed behaviour.
 */
const limiterState = vi.hoisted(() => ({ success: true, calls: 0 }));
vi.mock('./rate-limit', () => ({
	createLimiter: () => ({
		limit: async () => {
			limiterState.calls++;
			return { success: limiterState.success, reset: 0 };
		},
	}),
	rateLimitResponse: () => new Response('{}', { status: 429 }),
}));

const { guardCronRequest } = await import('./cron-guard');

const SECRET = 'cron-secret-value';
const req = (authorization?: string) =>
	new Request('http://localhost/api/cron/sweep', {
		headers: authorization ? { authorization } : {},
	});

describe('guardCronRequest', () => {
	it('lets a correctly authenticated request through', async () => {
		limiterState.success = true;
		expect(await guardCronRequest(req(`Bearer ${SECRET}`), 'k', SECRET)).toBeNull();
	});

	it('rejects a wrong secret of the SAME length (the compare is real, not a length check)', async () => {
		limiterState.success = true;
		const wrong = 'x'.repeat(SECRET.length);
		expect(wrong).toHaveLength(SECRET.length);
		const res = await guardCronRequest(req(`Bearer ${wrong}`), 'k', SECRET);
		expect(res?.status).toBe(401);
	});

	it('rejects a wrong secret of a DIFFERENT length without throwing', async () => {
		// node's timingSafeEqual throws on a length mismatch; the guard must return 401.
		limiterState.success = true;
		const res = await guardCronRequest(req('Bearer short'), 'k', SECRET);
		expect(res?.status).toBe(401);
	});

	it('rejects a missing authorization header', async () => {
		limiterState.success = true;
		expect((await guardCronRequest(req(), 'k', SECRET))?.status).toBe(401);
	});

	it('rejects a bare token without the Bearer scheme', async () => {
		limiterState.success = true;
		expect((await guardCronRequest(req(SECRET), 'k', SECRET))?.status).toBe(401);
	});

	it('returns 401 when the server has NO secret configured — never a fall-through', async () => {
		limiterState.success = true;
		expect((await guardCronRequest(req('Bearer anything'), 'k', undefined))?.status).toBe(401);
		expect((await guardCronRequest(req(), 'k', ''))?.status).toBe(401);
	});

	it('consults the limiter BEFORE the compare — a throttled guess is 429, not 401', async () => {
		limiterState.success = false;
		limiterState.calls = 0;
		// A *correct* credential still gets 429: proof the bucket is upstream of the compare,
		// not merely that a bad credential fails.
		const res = await guardCronRequest(req(`Bearer ${SECRET}`), 'k', SECRET);
		expect(res?.status).toBe(429);
		expect(limiterState.calls).toBe(1);
		limiterState.success = true;
	});
});
