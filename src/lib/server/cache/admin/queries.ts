import { redis } from '../index';
import { CacheError } from '../errors';
import { fetchUpstashMetrics } from '$lib/server/monitoring/upstash';
import { getFlagCacheSize } from '$lib/server/admin/flags';
import { getAnnouncementCacheSize } from '$lib/server/admin/announcements';
import type { CacheEntry, CacheEntryDetail, RedisType } from '../types';
import type { ProviderResult, UpstashMetrics } from '$lib/server/monitoring';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CacheOverview {
	totalKeys: number;
	keysByPrefix: Record<string, number>;
	keysByType: Record<string, number>;
	upstash: ProviderResult<UpstashMetrics>;
}

export interface InProcessCacheStatus {
	flagsCacheSize: number;
	announcementsCacheSize: number;
}

// ── Queries ──────────────────────────────────────────────────────────────────

function requireRedis() {
	if (!redis) throw new CacheError('credentials', 'Redis is not configured');
	return redis;
}

export async function getAllKeys(prefix?: string): Promise<CacheEntry[]> {
	const r = requireRedis();
	const pattern = prefix ? `${prefix}*` : '*';
	const keys = await r.keys(pattern);
	if (keys.length === 0) return [];

	const entries = await Promise.all(
		keys.map(async (key) => {
			const [type, ttl] = await Promise.all([r.type(key) as Promise<RedisType>, r.ttl(key)]);
			return { key, type, ttl };
		}),
	);

	return entries.sort((a, b) => a.key.localeCompare(b.key));
}

export async function getKeyDetail(key: string): Promise<CacheEntryDetail | null> {
	const r = requireRedis();
	const type = (await r.type(key)) as RedisType;
	if (type === 'none') return null;

	const ttl = await r.ttl(key);
	let value: unknown;

	switch (type) {
		case 'string':
			value = await r.get(key);
			break;
		case 'hash':
			value = await r.hgetall(key);
			break;
		case 'list':
			value = await r.lrange(key, 0, -1);
			break;
		case 'set':
			value = await r.smembers(key);
			break;
		case 'zset': {
			const members = await r.zrange(key, 0, -1, { withScores: true });
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

export async function getCacheOverview(): Promise<CacheOverview> {
	const r = requireRedis();
	const allKeys = await r.keys('*');

	const keysByPrefix: Record<string, number> = {};
	const keysByType: Record<string, number> = {};

	const typeResults = await Promise.all(
		allKeys.map(async (key) => {
			const type = (await r.type(key)) as RedisType;
			return { key, type };
		}),
	);

	for (const { key, type } of typeResults) {
		// Prefix grouping: take first segment before ':'
		const prefix = key.includes(':') ? key.split(':')[0] + ':' : 'other';
		keysByPrefix[prefix] = (keysByPrefix[prefix] ?? 0) + 1;
		keysByType[type] = (keysByType[type] ?? 0) + 1;
	}

	const upstash = await fetchUpstashMetrics();

	return {
		totalKeys: allKeys.length,
		keysByPrefix,
		keysByType,
		upstash,
	};
}

export function getInProcessCacheStatus(): InProcessCacheStatus {
	return {
		flagsCacheSize: getFlagCacheSize(),
		announcementsCacheSize: getAnnouncementCacheSize(),
	};
}
