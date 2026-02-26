import { redis } from '../index';
import { CacheError } from '../errors';
import { MAX_SHOWCASE_KEYS } from '$lib/server/config';

export const SHOWCASE_PREFIX = 'showcase:';

/** Ensure a key is within the showcase namespace. */
export function assertShowcaseKey(key: string): void {
	if (!key.startsWith(SHOWCASE_PREFIX)) {
		throw new CacheError('command', `Key must start with "${SHOWCASE_PREFIX}": ${key}`);
	}
}

/** Check if the showcase namespace has room for more keys. */
export async function checkKeyLimit(
	limit = MAX_SHOWCASE_KEYS,
): Promise<string | null> {
	const keys = await redis.keys(`${SHOWCASE_PREFIX}*`);
	if (keys.length >= limit) {
		return `Showcase limit reached (${limit} keys). Use reseed to clear.`;
	}
	return null;
}
