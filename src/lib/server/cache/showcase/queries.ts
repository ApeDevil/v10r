import { redis } from '../index';
import { Ratelimit } from '@upstash/ratelimit';
import type {
	CacheEntry,
	CacheEntryDetail,
	CacheConnectionInfo,
	CacheShowcaseStats,
	TtlSnapshot,
	RateLimitResult,
	RedisType,
} from '../types';

const SHOWCASE_PREFIX = 'showcase:';

// Module-level ephemeral cache for rate limiter (persists across warm invocations)
const ephemeralCache = new Map();

// ─── Connection page ────────────────────────────────────

export async function verifyConnection(): Promise<CacheConnectionInfo> {
	const start = performance.now();
	await redis.ping();
	const latencyMs = Math.round((performance.now() - start) * 100) / 100;

	const keys = await redis.keys(`${SHOWCASE_PREFIX}*`);

	return {
		connected: true,
		latencyMs,
		keyCount: keys.length,
		measuredAt: new Date().toISOString(),
	};
}

// ─── Patterns page ──────────────────────────────────────

export async function listShowcaseEntries(): Promise<CacheEntry[]> {
	const keys = await redis.keys(`${SHOWCASE_PREFIX}*`);
	if (keys.length === 0) return [];

	// Parallel TYPE + TTL for each key (auto-pipelined by @upstash/redis)
	const entries = await Promise.all(
		keys.map(async (key) => {
			const [type, ttl] = await Promise.all([
				redis.type(key) as Promise<RedisType>,
				redis.ttl(key),
			]);
			return { key, type, ttl };
		}),
	);

	return entries.sort((a, b) => a.key.localeCompare(b.key));
}

export async function getEntryDetail(key: string): Promise<CacheEntryDetail | null> {
	const type = await redis.type(key) as RedisType;
	if (type === 'none') return null;

	const ttl = await redis.ttl(key);
	let value: unknown;

	switch (type) {
		case 'string':
			value = await redis.get(key);
			break;
		case 'hash':
			value = await redis.hgetall(key);
			break;
		case 'list':
			value = await redis.lrange(key, 0, -1);
			break;
		case 'set':
			value = await redis.smembers(key);
			break;
		case 'zset': {
			// Return members with scores
			const members = await redis.zrange(key, 0, -1, { withScores: true });
			// zrange with withScores returns [member, score, member, score, ...]
			const pairs: Array<{ member: string; score: number }> = [];
			for (let i = 0; i < members.length; i += 2) {
				pairs.push({ member: members[i] as string, score: Number(members[i + 1]) });
			}
			value = pairs;
			break;
		}
		default:
			value = null;
	}

	return { key, type, ttl, value };
}

export async function getShowcaseStats(): Promise<CacheShowcaseStats> {
	const entries = await listShowcaseEntries();
	const keysByType: Record<string, number> = {};

	for (const entry of entries) {
		keysByType[entry.type] = (keysByType[entry.type] ?? 0) + 1;
	}

	return { keyCount: entries.length, keysByType };
}

// ─── Ephemeral page ─────────────────────────────────────

export async function getTtlSnapshot(key: string): Promise<TtlSnapshot> {
	const ttl = await redis.ttl(key);

	return {
		key,
		remainingSeconds: ttl,
		isExpired: ttl === -2,
		capturedAt: new Date().toISOString(),
	};
}

export async function checkRateLimit(
	identifier: string,
	limit = 10,
	windowSeconds = 10,
): Promise<RateLimitResult> {
	const ratelimit = new Ratelimit({
		redis,
		limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
		ephemeralCache,
	});

	const result = await ratelimit.limit(identifier);

	return {
		allowed: result.success,
		remaining: result.remaining,
		limit: result.limit,
		resetAt: new Date(result.reset).toISOString(),
		windowSeconds,
	};
}
