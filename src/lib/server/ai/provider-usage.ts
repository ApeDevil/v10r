import { redis } from '$lib/server/cache';

/**
 * Per-provider daily usage signals that `conversation_step` can't capture.
 *
 * `conversation_step` records one row per *successful* AI SDK step, so it's the
 * system of record for request/token counts (see getProviderUsageToday). But two
 * quota-relevant signals never reach it:
 *   - 429s / rate-limit trips: the request errored before a step finished.
 *   - embedding calls: retrieval embeddings (gemini-embedding-001) go through
 *     retrieval/embed.ts on the *same* Google key, never the chat orchestrator.
 *
 * Both are counted here in Redis (cross-instance, unlike an in-process Map),
 * bucketed by UTC day with a ~25h TTL so the key self-expires. Best-effort and
 * non-blocking: a Redis hiccup must never break a chat turn, so writes swallow.
 */
const KEY_PREFIX = 'ai:usage:';
const TTL_SECONDS = 25 * 60 * 60;

function dayKey(kind: 'rl' | 'embed', id: string): string {
	const day = new Date().toISOString().slice(0, 10);
	return `${KEY_PREFIX}${kind}:${id}:${day}`;
}

/** Record a rate-limit (429) hit for a provider. Fire-and-forget. */
export async function incrProvider429(providerId: string): Promise<void> {
	if (!redis) return;
	try {
		const key = dayKey('rl', providerId);
		await redis.incr(key);
		await redis.expire(key, TTL_SECONDS);
	} catch (err) {
		console.error('[ai:usage] Failed to record 429:', err);
	}
}

/** Record embedding calls (always Google in this app). Fire-and-forget. */
export async function incrEmbeddingCalls(count = 1, providerId = 'google'): Promise<void> {
	if (!redis || count <= 0) return;
	try {
		const key = dayKey('embed', providerId);
		await redis.incrby(key, count);
		await redis.expire(key, TTL_SECONDS);
	} catch (err) {
		console.error('[ai:usage] Failed to record embeddings:', err);
	}
}

export interface ProviderRedisUsage {
	/** Rate-limit (429) hits today (UTC). */
	rateLimited: number;
	/** Embedding calls today (UTC) — non-zero only for the embedding provider. */
	embeddings: number;
}

/** Read today's Redis-only usage signals for a provider. Never throws. */
export async function readProviderRedisUsage(providerId: string): Promise<ProviderRedisUsage> {
	if (!redis) return { rateLimited: 0, embeddings: 0 };
	try {
		const [rateLimited, embeddings] = await Promise.all([
			redis.get<number>(dayKey('rl', providerId)),
			redis.get<number>(dayKey('embed', providerId)),
		]);
		return { rateLimited: rateLimited ?? 0, embeddings: embeddings ?? 0 };
	} catch (err) {
		console.error('[ai:usage] Failed to read usage:', err);
		return { rateLimited: 0, embeddings: 0 };
	}
}
