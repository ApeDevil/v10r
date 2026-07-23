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

	// Peek only — a denied attempt must not consume quota, or retrying while
	// limited keeps the sliding window full and extends the lockout forever.
	// The slot is consumed by recordEmailSend() once a send actually happened.
	const { remaining, reset } = await limiter.peek(hashEmail(normalized));
	if (remaining <= 0) {
		const retryAfterMs = Math.max(0, reset - Date.now());
		return denied('rate-limit', 'Too many requests for this email. Try again later.', 429, retryAfterMs);
	}
	return allowed;
}

/**
 * Consume one per-email slot after a send was accepted. Peek-then-record is
 * not atomic — a concurrent burst can overshoot the window by a few sends —
 * but each attempt still pays a fresh ALTCHA solve and the per-IP auth
 * limiter caps the burst rate, so the overshoot is bounded and the trade
 * (denied attempts no longer extend the lockout) is worth it.
 */
export async function recordEmailSend(email: string): Promise<void> {
	// The send already happened — the result is irrelevant, only the count is.
	await limiter.limit(hashEmail(email.trim()));
}
