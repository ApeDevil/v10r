import { redis } from '../index';
import { CacheError } from '../errors';
import { invalidateFlagCache } from '$lib/server/admin/flags';
import { invalidateAnnouncementCache } from '$lib/server/admin/announcements';

function requireRedis() {
	if (!redis) throw new CacheError('credentials', 'Redis is not configured');
	return redis;
}

/** Delete a single key (no showcase guard). */
export async function adminDeleteKey(key: string): Promise<boolean> {
	const r = requireRedis();
	const result = await r.del(key);
	return result > 0;
}

/** Flush all keys matching a prefix. Returns count deleted. */
export async function adminFlushByPrefix(prefix: string): Promise<number> {
	const r = requireRedis();
	const keys = await r.keys(`${prefix}*`);
	if (keys.length === 0) return 0;
	const result = await r.del(...keys);
	return result;
}

/** Invalidate all in-process caches (flags + announcements). */
export function adminInvalidateInProcessCaches(): void {
	invalidateFlagCache();
	invalidateAnnouncementCache();
}
