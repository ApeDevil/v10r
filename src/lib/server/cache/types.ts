/** Core types for the Redis cache layer. */

export type RedisType = 'string' | 'hash' | 'list' | 'set' | 'zset' | 'none';

export interface CacheEntry {
	key: string;
	type: RedisType;
	ttl: number; // -2=gone, -1=no TTL, else seconds remaining
}

export interface CacheEntryDetail extends CacheEntry {
	value: unknown;
}

export interface CacheConnectionInfo {
	connected: boolean;
	latencyMs: number;
	keyCount: number;
	measuredAt: string;
}

export interface CacheShowcaseStats {
	keyCount: number;
	keysByType: Record<string, number>;
}

export interface TtlSnapshot {
	key: string;
	remainingSeconds: number;
	isExpired: boolean;
	capturedAt: string;
}

export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	limit: number;
	resetAt: string;
	windowSeconds: number;
}
