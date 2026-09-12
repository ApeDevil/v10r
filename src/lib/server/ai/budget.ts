import { dev } from '$app/environment';
import type { Decision } from '$lib/server/abuse';
import { allowed, denied } from '$lib/server/abuse';
import { redis } from '$lib/server/cache';
import { DAILY_TOKEN_CAP } from './config';

/**
 * Per-user daily AI token budget.
 *
 * `checkUserBudget` runs at request entry (cheap GET); rejects if today's
 * spend already exceeds the cap. `chargeTokens` runs once the model is done
 * (the orchestrator's post-text stage) to record actuals.
 *
 * v1 caveat: this is a check-then-charge pattern, not pre-charge-then-reconcile.
 * A burst of N parallel requests can each pass the gate before any has
 * charged, so the daily total can overshoot by up to N × MAX_TOKENS before
 * the cap engages. Worst-case overshoot is ~$0.20-0.50 (≪ daily-cap dollars),
 * acceptable for v1. Upgrade to atomic pre-charge if abuse data warrants.
 */
const KEY_PREFIX = 'ai:budget:';
const TTL_SECONDS = 25 * 60 * 60;

function dayKey(userId: string): string {
	const day = new Date().toISOString().slice(0, 10);
	return `${KEY_PREFIX}${userId}:${day}`;
}

export async function checkUserBudget(userId: string): Promise<Decision> {
	if (!redis) {
		if (dev) return allowed;
		console.error('[ai:budget] Redis unavailable — denying for safety');
		return denied('rate-limit', 'Budget check unavailable.', 429);
	}

	const used = (await redis.get<number>(dayKey(userId))) ?? 0;
	if (used >= DAILY_TOKEN_CAP) {
		return denied('rate-limit', 'Daily AI usage budget reached. Try again tomorrow.', 429, msUntilUtcMidnight());
	}
	return allowed;
}

export async function chargeTokens(userId: string, tokens: number): Promise<void> {
	if (!redis || tokens <= 0) return;
	const key = dayKey(userId);
	// One round trip for the increment and the TTL that retires the key with its day —
	// this runs on the answer path, between the last token and `finish`.
	await redis.pipeline().incrby(key, tokens).expire(key, TTL_SECONDS).exec();
}

function msUntilUtcMidnight(): number {
	const now = new Date();
	const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
	return tomorrow.getTime() - now.getTime();
}
