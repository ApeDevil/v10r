import { CacheError } from '$lib/server/cache';

export const SHOWCASE_CACHE_PREFIX = 'showcase:';

/**
 * Ensure a Redis key is within the showcase cache namespace.
 *
 * Named for its store: `store/guards.ts` holds the R2 object equivalent, and the two are
 * not interchangeable — that one uses a `/` delimiter and additionally refuses the private
 * per-user prefixes that share the namespace (SEC-N01).
 */
export function assertShowcaseCacheKey(key: string): void {
	if (!key.startsWith(SHOWCASE_CACHE_PREFIX)) {
		throw new CacheError('command', `Key must start with "${SHOWCASE_CACHE_PREFIX}": ${key}`);
	}
}
