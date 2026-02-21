import { redis } from '../index';
import { assertShowcaseKey } from './guards';

// ─── Strings ────────────────────────────────────────────

export async function setString(key: string, value: string, ttl?: number): Promise<void> {
	assertShowcaseKey(key);
	if (ttl && ttl > 0) {
		await redis.set(key, value, { ex: ttl });
	} else {
		await redis.set(key, value);
	}
}

export async function deleteKey(key: string): Promise<void> {
	assertShowcaseKey(key);
	await redis.del(key);
}

// ─── Counters ───────────────────────────────────────────

export async function incrementCounter(key: string, amount = 1): Promise<number> {
	assertShowcaseKey(key);
	return redis.incrby(key, amount);
}

export async function decrementCounter(key: string, amount = 1): Promise<number> {
	assertShowcaseKey(key);
	return redis.decrby(key, amount);
}

// ─── Hashes ─────────────────────────────────────────────

export async function setHashField(key: string, field: string, value: string): Promise<void> {
	assertShowcaseKey(key);
	await redis.hset(key, { [field]: value });
}

export async function deleteHashField(key: string, field: string): Promise<void> {
	assertShowcaseKey(key);
	await redis.hdel(key, field);
}

// ─── Sorted Sets ────────────────────────────────────────

export async function addToSortedSet(key: string, member: string, score: number): Promise<void> {
	assertShowcaseKey(key);
	await redis.zadd(key, { score, member });
}

export async function removeFromSortedSet(key: string, member: string): Promise<void> {
	assertShowcaseKey(key);
	await redis.zrem(key, member);
}

// ─── Lists ──────────────────────────────────────────────

export async function pushToList(
	key: string,
	value: string,
	side: 'left' | 'right' = 'right',
): Promise<void> {
	assertShowcaseKey(key);
	if (side === 'left') {
		await redis.lpush(key, value);
	} else {
		await redis.rpush(key, value);
	}
}

export async function popFromList(
	key: string,
	side: 'left' | 'right' = 'left',
): Promise<string | null> {
	assertShowcaseKey(key);
	if (side === 'left') {
		return redis.lpop(key);
	}
	return redis.rpop(key);
}

// ─── TTL management ─────────────────────────────────────

export async function setTtl(key: string, seconds: number): Promise<void> {
	assertShowcaseKey(key);
	await redis.expire(key, seconds);
}

export async function removeTtl(key: string): Promise<void> {
	assertShowcaseKey(key);
	await redis.persist(key);
}

/** Sliding TTL: refresh the TTL to a new value, returns the new TTL. */
export async function slideTtl(key: string, seconds: number): Promise<number> {
	assertShowcaseKey(key);
	await redis.expire(key, seconds);
	return redis.ttl(key);
}
