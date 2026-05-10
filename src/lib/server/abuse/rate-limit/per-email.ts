import { createHash } from 'node:crypto';
import { createLimiter } from '$lib/server/api/rate-limit';
import { PER_EMAIL_LIMIT_MAX, PER_EMAIL_LIMIT_PREFIX, PER_EMAIL_LIMIT_WINDOW } from '../config';
import { allowed, denied } from '../decision';
import type { Decision } from '../types';

/**
 * Per-target-email rate limit (R1 — email-bombing fix).
 *
 * Magic-link and email-OTP send endpoints accept an arbitrary `email` field, so
 * a botnet rotating across many IPs can drain Resend quota and hammer one
 * victim's inbox even with per-IP limits in place. Keying the bucket on a
 * SHA-256 of the normalized email closes that vector regardless of source IP.
 *
 * The hash is one-way and identifier-only; we never store the raw email in
 * Redis. Window: 5 sends per email per hour.
 */
const limiter = createLimiter(PER_EMAIL_LIMIT_PREFIX, PER_EMAIL_LIMIT_MAX, PER_EMAIL_LIMIT_WINDOW);

function hashEmail(email: string): string {
	return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

export async function checkEmailRateLimit(email: string): Promise<Decision> {
	const normalized = email.trim();
	if (!normalized) return denied('rate-limit', 'Missing email', 400);

	const { success, reset } = await limiter.limit(hashEmail(normalized));
	if (!success) {
		const retryAfterMs = Math.max(0, reset - Date.now());
		return denied('rate-limit', 'Too many requests for this email. Try again later.', 429, retryAfterMs);
	}
	return allowed;
}
