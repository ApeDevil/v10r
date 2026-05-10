import { deriveKey } from 'altcha-lib/algorithms/pbkdf2';
import { create } from 'altcha-lib/frameworks/sveltekit';
import { redis } from '$lib/server/cache';
import { ALTCHA_HMAC_KEY, BOT_DETECTION_MODE } from './config';
import { allowed, denied } from './decision';
import type { Decision } from './types';

/**
 * Upstash-backed replay store. ALTCHA records each consumed challenge
 * signature so a stolen / replayed payload is rejected on the second use.
 * Store TTL is set via Redis EX so entries auto-expire after the challenge
 * window — no manual sweep needed.
 */
const REPLAY_KEY_PREFIX = 'altcha:nonce:';
const REPLAY_TTL_SECONDS = 10 * 60;

const replayStore = {
	async get(key: string) {
		if (!redis) return null;
		return await redis.get(`${REPLAY_KEY_PREFIX}${key}`);
	},
	async set(key: string, _value: boolean) {
		if (!redis) return;
		await redis.set(`${REPLAY_KEY_PREFIX}${key}`, '1', { ex: REPLAY_TTL_SECONDS });
	},
};

const altcha = ALTCHA_HMAC_KEY
	? create({
			hmacSignatureSecret: ALTCHA_HMAC_KEY,
			deriveKey,
			createChallengeParameters: () => ({
				algorithm: 'PBKDF2/SHA-256',
				cost: 100_000,
			}),
			store: replayStore,
		})
	: null;

export async function altchaChallengeHandler(): Promise<Response> {
	if (!altcha) {
		return new Response(JSON.stringify({ error: { code: 'config_error', message: 'Captcha not configured' } }), {
			status: 500,
			headers: { 'content-type': 'application/json' },
		});
	}
	return altcha.challengeHandler();
}

async function verifyAltchaInternal(payload: string | null): Promise<Decision> {
	if (!payload) return denied('altcha', 'Missing captcha solution', 400);
	if (!altcha || !ALTCHA_HMAC_KEY) {
		console.error('[altcha] ALTCHA_HMAC_KEY not configured');
		return denied('altcha', 'Captcha not configured', 403);
	}

	try {
		const result = await altcha.verify(payload, deriveKey, ALTCHA_HMAC_KEY, undefined, replayStore);
		if (result.error || !result.verification?.verified) {
			return denied('altcha', result.error ?? 'Invalid or replayed captcha', 403);
		}
		return allowed;
	} catch {
		return denied('altcha', 'Invalid captcha payload', 400);
	}
}

/**
 * Verify an ALTCHA solution payload (string).
 *
 * Honors BOT_DETECTION_MODE:
 * - 'live'    — denials short-circuit the request.
 * - 'dry_run' — denials are logged but converted to allowed (calibration mode).
 * - 'off'     — verification skipped entirely (emergency only).
 */
export async function verifyAltcha(payload: string | undefined | null): Promise<Decision> {
	if (BOT_DETECTION_MODE === 'off') return allowed;
	const result = await verifyAltchaInternal(payload ?? null);
	if (!result.allowed && BOT_DETECTION_MODE === 'dry_run') {
		console.warn(`[altcha] dry_run: would have denied (${result.reason})`);
		return allowed;
	}
	return result;
}
