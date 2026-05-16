import { ALTCHA_CHALLENGE_EXPIRY_MS, ALTCHA_HMAC_KEY, BOT_DETECTION_MODE } from '$lib/server/abuse';
import { redis } from '$lib/server/cache';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		title: 'Captcha - Anti-Abuse - Showcases',
		mode: BOT_DETECTION_MODE,
		hmacConfigured: ALTCHA_HMAC_KEY.length >= 32,
		hmacKeyLength: ALTCHA_HMAC_KEY.length,
		algorithm: 'PBKDF2/SHA-256',
		cost: 100_000,
		challengeExpiryMs: ALTCHA_CHALLENGE_EXPIRY_MS,
		replayStore: {
			backend: redis ? 'Upstash Redis' : 'unavailable',
			keyPrefix: 'altcha:nonce:',
			ttlSeconds: 10 * 60,
		},
		challengeRateLimit: {
			max: 30,
			window: '60 s',
			keyedOn: 'client IP',
		},
	};
};
