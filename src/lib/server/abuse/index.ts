export { verifyAltcha } from './altcha';
export { logBlocked } from './audit';
export { getClientIp, normalizeIpKey } from './client-ip';
export type { BotDetectionMode } from './config';
export {
	ALTCHA_CHALLENGE_EXPIRY_MS,
	ALTCHA_HMAC_KEY,
	BOT_DETECTION_MODE,
	PER_EMAIL_LIMIT_MAX,
	PER_EMAIL_LIMIT_PREFIX,
	PER_EMAIL_LIMIT_WINDOW,
} from './config';
export { allowed, authDecisionResponse, decisionResponse, denied } from './decision';
export { checkHoneypot, HONEYPOT_FIELD_NAME, HONEYPOT_MIN_FILL_MS } from './honeypot';
export { checkEmailRateLimit, recordEmailSend } from './rate-limit/per-email';
export type { Decision } from './types';
