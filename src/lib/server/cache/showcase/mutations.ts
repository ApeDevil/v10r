import { redis } from '../index';
import { CacheError } from '../errors';
import { assertShowcaseKey } from './guards';

function requireRedis() {
	if (!redis) throw new CacheError('credentials', 'Redis is not configured');
	return redis;
}

// ─── Strings ────────────────────────────────────────────

export async function setString(key: string, value: string, ttl?: number): Promise<void> {
	const r = requireRedis();
	assertShowcaseKey(key);
	if (ttl && ttl > 0) {
		await r.set(key, value, { ex: ttl });
	} else {
		await r.set(key, value);
	}
}

export async function deleteKey(key: string): Promise<void> {
	const r = requireRedis();
	assertShowcaseKey(key);
	await r.del(key);
}

// ─── Counters ───────────────────────────────────────────

export async function incrementCounter(key: string, amount = 1): Promise<number> {
	const r = requireRedis();
	assertShowcaseKey(key);
	return r.incrby(key, amount);
}

export async function decrementCounter(key: string, amount = 1): Promise<number> {
	const r = requireRedis();
	assertShowcaseKey(key);
	return r.decrby(key, amount);
}

// ─── Hashes ─────────────────────────────────────────────

export async function setHashField(key: string, field: string, value: string): Promise<void> {
	const r = requireRedis();
	assertShowcaseKey(key);
	await r.hset(key, { [field]: value });
}

export async function deleteHashField(key: string, field: string): Promise<void> {
	const r = requireRedis();
	assertShowcaseKey(key);
	await r.hdel(key, field);
}

// ─── Sorted Sets ────────────────────────────────────────

export async function addToSortedSet(key: string, member: string, score: number): Promise<void> {
	const r = requireRedis();
	assertShowcaseKey(key);
	await r.zadd(key, { score, member });
}

export async function removeFromSortedSet(key: string, member: string): Promise<void> {
	const r = requireRedis();
	assertShowcaseKey(key);
	await r.zrem(key, member);
}

// ─── Lists ──────────────────────────────────────────────

export async function pushToList(
	key: string,
	value: string,
	side: 'left' | 'right' = 'right',
): Promise<void> {
	const r = requireRedis();
	assertShowcaseKey(key);
	if (side === 'left') {
		await r.lpush(key, value);
	} else {
		await r.rpush(key, value);
	}
}

export async function popFromList(
	key: string,
	side: 'left' | 'right' = 'left',
): Promise<string | null> {
	const r = requireRedis();
	assertShowcaseKey(key);
	if (side === 'left') {
		return r.lpop(key);
	}
	return r.rpop(key);
}

// ─── TTL management ─────────────────────────────────────

export async function setTtl(key: string, seconds: number): Promise<void> {
	const r = requireRedis();
	assertShowcaseKey(key);
	await r.expire(key, seconds);
}

export async function removeTtl(key: string): Promise<void> {
	const r = requireRedis();
	assertShowcaseKey(key);
	await r.persist(key);
}

/** Sliding TTL: refresh the TTL to a new value, returns the new TTL. */
export async function slideTtl(key: string, seconds: number): Promise<number> {
	const r = requireRedis();
	assertShowcaseKey(key);
	await r.expire(key, seconds);
	return r.ttl(key);
}
