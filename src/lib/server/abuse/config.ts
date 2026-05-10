import { env } from '$env/dynamic/private';

export type BotDetectionMode = 'live' | 'dry_run' | 'off';

function parseMode(v: string | undefined): BotDetectionMode {
	if (v === 'live' || v === 'dry_run' || v === 'off') return v;
	return 'live';
}

/**
 * Global enforcement mode for abuse-prevention layers.
 * - 'live'   — checks enforced; denies short-circuit the request.
 * - 'dry_run' — checks computed and audited but never deny (for calibration).
 * - 'off'    — checks skipped entirely (emergency-only; do NOT use in prod).
 */
export const BOT_DETECTION_MODE: BotDetectionMode = parseMode(env.BOT_DETECTION_MODE);

/** ALTCHA HMAC key — signs and verifies challenges. */
export const ALTCHA_HMAC_KEY = env.ALTCHA_HMAC_KEY ?? '';

/** Challenge expiry window (ms). Short to bound replay even if the nonce store hiccups. */
export const ALTCHA_CHALLENGE_EXPIRY_MS = 5 * 60 * 1000;

/**
 * Per-email rate limit (R1: email-bombing fix).
 * Keyed on sha256(normalized_email); enforced on magic-link send + email-OTP send + signup.
 */
export const PER_EMAIL_LIMIT_MAX = 5;
export const PER_EMAIL_LIMIT_WINDOW = '1 h' as const;
export const PER_EMAIL_LIMIT_PREFIX = 'rl:abuse:email';

const DUMMY_KEY_PATTERNS = [/^test[_-]/i, /^dummy[_-]/i, /^example[_-]/i, /^changeme/i, /^placeholder/i];

/**
 * Fail closed at module load if production config is broken.
 * Caught early by `vite build` and Vercel deploys — never silently misconfigured in prod.
 */
function assertProductionConfig(): void {
	if (process.env.NODE_ENV !== 'production') return;

	if (BOT_DETECTION_MODE !== 'live') {
		throw new Error(`BOT_DETECTION_MODE must be 'live' in production (got '${BOT_DETECTION_MODE}')`);
	}
	if (ALTCHA_HMAC_KEY.length < 32) {
		throw new Error('ALTCHA_HMAC_KEY must be at least 32 characters in production');
	}
	if (DUMMY_KEY_PATTERNS.some((rx) => rx.test(ALTCHA_HMAC_KEY))) {
		throw new Error('ALTCHA_HMAC_KEY appears to be a placeholder value');
	}
}

assertProductionConfig();
