import { Redis } from '@upstash/redis';
import { env } from '$env/dynamic/private';

function createRedis(): Redis | null {
	const url = env.UPSTASH_REDIS_REST_URL;
	const token = env.UPSTASH_REDIS_REST_TOKEN;
	if (!url || !token) return null;
	return new Redis({ url, token });
}

export const redis: Redis | null = createRedis();

// Public surface — see the note in `store/index.ts`; same shape, same reason.
export { CacheError, type CacheErrorKind, classifyCacheError } from './errors';
export * from './types';
