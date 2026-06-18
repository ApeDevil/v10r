/**
 * STEP-UP FRESHNESS — Redis-backed "recently re-verified" gate.
 *
 * A successful TOTP / backup-code verification stamps `stepup:<userId>` with a
 * STEPUP_TTL expiry (set by the auth after-hook). Sensitive actions check the
 * key instead of the session: freshness must never ride the cookie cache, and
 * Upstash TTL expiry is unambiguously fail-closed (a missing key can only
 * block, never permit).
 *
 * Redis unavailable: dev passes with a warning (mirrors rate-limit.ts
 * passthrough); prod fails closed — gated actions demand a re-verification
 * that cannot succeed, which is the correct direction for a security gate.
 *
 * This module must never import the Better Auth instance (cycle risk:
 * auth/index.ts imports from here via its hooks).
 */
import { dev } from '$app/environment';
import { redis } from '$lib/server/cache';
import { STEPUP_TTL } from '$lib/server/config';

const key = (userId: string) => `stepup:${userId}`;

/**
 * Rate-limit key for the second-factor verify endpoints. Keyed on the pending
 * user id when resolvable — so IP rotation can't multiply the attempt budget
 * against a known account's 6-digit TOTP space — falling back to client IP.
 */
export function twoFactorVerifyLimitKey(userId: string | null | undefined, clientIp: string | null): string {
	return userId ?? clientIp ?? 'anon';
}

/** Record a successful second-factor verification for STEPUP_TTL seconds. */
export async function stampStepUp(userId: string): Promise<void> {
	if (!redis) {
		if (dev) console.warn('[step-up] Redis unavailable — step-up stamp skipped');
		return;
	}
	await redis.set(key(userId), Date.now(), { ex: STEPUP_TTL });
}

/** True when the user verified a second factor within the freshness window. */
export async function isStepUpFresh(userId: string): Promise<boolean> {
	if (!redis) {
		if (dev) {
			console.warn('[step-up] Redis unavailable — step-up gate DISABLED (dev passthrough)');
			return true;
		}
		console.error('[step-up] Redis unavailable — step-up gate fails closed');
		return false;
	}
	return (await redis.exists(key(userId))) === 1;
}

/**
 * Gate check for sensitive actions: passes outright for users without TOTP
 * enrolled (nothing to step up with), otherwise requires a fresh stamp.
 */
export async function requireStepUp(user: { id: string; twoFactorEnabled?: boolean | null }): Promise<boolean> {
	if (!user.twoFactorEnabled) return true;
	return isStepUpFresh(user.id);
}
