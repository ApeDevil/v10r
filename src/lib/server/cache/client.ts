import { Redis } from '@upstash/redis';
import { env } from '$env/dynamic/private';

/**
 * The Upstash client, or `null` when this deployment has no Redis configured.
 *
 * Nullable on purpose and everywhere: local containers, CI and preview branches run
 * without Upstash, and every consumer has to state what it does then. `rate-limit.ts`
 * makes that choice explicit (`onError: 'open' | 'closed'`); the caches degrade to a
 * miss, which is always correct if slower.
 *
 * Split out of `index.ts` so the barrel can re-export the cache modules that need this
 * client without the barrel importing itself through them.
 */
function createRedis(): Redis | null {
	const url = env.UPSTASH_REDIS_REST_URL;
	const token = env.UPSTASH_REDIS_REST_TOKEN;
	if (!url || !token) return null;
	return new Redis({ url, token });
}

export const redis: Redis | null = createRedis();
