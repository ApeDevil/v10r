import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertProductionConfig } from './config';
import { allowed, denied } from './decision';
import { authDecisionResponse, decisionResponse } from './decision.adapter';

describe('decisionResponse', () => {
	it('keeps the nested apiError contract for general API surfaces', async () => {
		const res = decisionResponse(denied('altcha', 'Missing captcha solution', 400));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body).toEqual({ error: { code: 'captcha_required', message: 'Missing captcha solution' } });
	});

	it('throws when called on an allowed decision', () => {
		expect(() => decisionResponse(allowed)).toThrow();
	});
});

describe('authDecisionResponse', () => {
	it('answers in the auth dialect — top-level code and message', async () => {
		const res = authDecisionResponse(denied('altcha', 'Invalid or replayed captcha', 403));
		expect(res.status).toBe(403);
		const body = await res.json();
		// The Better Auth client reads body.message / body.code at the top level;
		// a nested shape here regresses every gate denial into generic UI copy.
		expect(body.code).toBe('captcha_required');
		expect(body.message).toBe('Invalid or replayed captcha');
		expect(body.error).toBeUndefined();
	});

	it('carries retryAfterSeconds in body and Retry-After header on rate limits', async () => {
		const res = authDecisionResponse(denied('rate-limit', 'Too many requests for this email.', 429, 150_000));
		expect(res.status).toBe(429);
		expect(res.headers.get('Retry-After')).toBe('150');
		const body = await res.json();
		expect(body).toEqual({
			code: 'rate_limited',
			message: 'Too many requests for this email.',
			retryAfterSeconds: 150,
		});
	});

	it('omits retryAfterSeconds when the decision has no retry window', async () => {
		const res = authDecisionResponse(denied('honeypot', 'Invalid request', 400));
		expect(res.headers.get('Retry-After')).toBeNull();
		const body = await res.json();
		expect(body).toEqual({ code: 'invalid_request', message: 'Invalid request' });
	});

	it('throws when called on an allowed decision', () => {
		expect(() => authDecisionResponse(allowed)).toThrow();
	});
});

/**
 * ALTCHA verification, and the two switches that can turn it off.
 *
 * `verifyAltcha` is the captcha gate in front of the auth surfaces, so the cases that
 * matter are the ones where it stops being a gate:
 *
 *  - **Unconfigured must deny, not allow.** `ALTCHA_HMAC_KEY` absent in one environment
 *    is a deployment mistake; failing open would silently drop the control everywhere.
 *  - **`dry_run` converts denials to allows.** That is deliberate — it is calibration
 *    mode — but it is a full bypass, so it is pinned here rather than left to be
 *    discovered from production traffic.
 *  - **`off` skips verification entirely** and must not even reach the verifier.
 *
 * `BOT_DETECTION_MODE` and `ALTCHA_HMAC_KEY` are module-level constants captured when
 * `altcha.ts` first loads, so each case re-imports the module under a fresh config mock.
 */
describe('verifyAltcha — configuration and bypass modes', () => {
	async function loadAltcha(mode: 'live' | 'dry_run' | 'off', hmacKey: string | undefined) {
		vi.resetModules();
		vi.doMock('$lib/server/cache', () => ({ redis: null }));
		vi.doMock('./config', () => ({ BOT_DETECTION_MODE: mode, ALTCHA_HMAC_KEY: hmacKey }));
		return import('./altcha');
	}

	beforeEach(() => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.doUnmock('$lib/server/cache');
		vi.doUnmock('./config');
		vi.restoreAllMocks();
		vi.resetModules();
	});

	it('denies a missing payload with an actionable 400', async () => {
		const { verifyAltcha } = await loadAltcha('live', 'k'.repeat(32));
		expect(await verifyAltcha(undefined)).toMatchObject({
			allowed: false,
			layer: 'altcha',
			status: 400,
			reason: 'Missing captcha solution',
		});
	});

	it('denies when ALTCHA_HMAC_KEY is unset — fails CLOSED, never open', async () => {
		const { verifyAltcha } = await loadAltcha('live', undefined);
		expect(await verifyAltcha('any-payload')).toMatchObject({ allowed: false, status: 403 });
	});

	it('denies a malformed payload rather than throwing into the caller', async () => {
		const { verifyAltcha } = await loadAltcha('live', 'k'.repeat(32));
		const result = await verifyAltcha('not-a-real-altcha-payload');
		expect(result.allowed).toBe(false);
	});

	it('dry_run converts a real denial into an allow — a full bypass, by design', async () => {
		const { verifyAltcha } = await loadAltcha('dry_run', 'k'.repeat(32));
		// The same input that is a 400 under `live`:
		expect(await verifyAltcha(undefined)).toMatchObject({ allowed: true });
		expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('dry_run'));
	});

	it('dry_run still bypasses when the key is unset — misconfiguration is invisible here', async () => {
		const { verifyAltcha } = await loadAltcha('dry_run', undefined);
		expect(await verifyAltcha('any-payload')).toMatchObject({ allowed: true });
	});

	it('off skips verification entirely, without inspecting the payload', async () => {
		const { verifyAltcha } = await loadAltcha('off', undefined);
		expect(await verifyAltcha(undefined)).toMatchObject({ allowed: true });
		expect(await verifyAltcha('garbage')).toMatchObject({ allowed: true });
		// Nothing was evaluated, so nothing was logged.
		expect(console.error).not.toHaveBeenCalled();
		expect(console.warn).not.toHaveBeenCalled();
	});

	it('the challenge endpoint answers 500 with a config_error when unconfigured', async () => {
		const { altchaChallengeHandler } = await loadAltcha('live', undefined);
		const res = await altchaChallengeHandler();
		expect(res.status).toBe(500);
		expect((await res.json()).error.code).toBe('config_error');
	});
});

/**
 * The check that stands between `dry_run` and production.
 *
 * `verifyAltcha` in `dry_run` converts every denial into an allow — a complete captcha
 * bypass, pinned above. Nothing stops that mode reaching production except this assertion,
 * which runs once at module load.
 *
 * It is gated on `dev`, Vite's build-mode constant, rather than on `NODE_ENV`: an env var can
 * arrive wrong in the direction that SKIPS the check, and this repo has already shipped a
 * container that builds with `NODE_ENV=development`. The gate had no test at all before,
 * because a module that throws on import cannot be re-imported under a second config — hence
 * the injectable parameters.
 */
describe('assertProductionConfig', () => {
	const KEY = 'k'.repeat(32);

	it('is inert under the dev server, whatever the config says', () => {
		expect(() => assertProductionConfig('dry_run', '', true)).not.toThrow();
	});

	it('accepts a well-formed production config', () => {
		expect(() => assertProductionConfig('live', KEY, false)).not.toThrow();
	});

	it.each(['dry_run', 'off'] as const)('refuses to boot a build in %s mode', (mode) => {
		expect(() => assertProductionConfig(mode, KEY, false)).toThrow(/BOT_DETECTION_MODE/);
	});

	it.each([
		['too short', 'k'.repeat(31)],
		['absent', ''],
	])('refuses to boot a build whose HMAC key is %s', (_label, key) => {
		expect(() => assertProductionConfig('live', key, false)).toThrow(/at least 32/);
	});

	it('refuses to boot a build carrying a placeholder key', () => {
		expect(() => assertProductionConfig('live', `changeme-${'x'.repeat(30)}`, false)).toThrow(/placeholder/);
	});
});
