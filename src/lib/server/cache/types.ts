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

/** Format seconds into a human-readable TTL string. */
export function formatTtl(seconds: number): string {
	if (seconds === -2) return 'expired';
	if (seconds === -1) return 'no expiry';
	if (seconds < 60) return `${seconds}s`;
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
