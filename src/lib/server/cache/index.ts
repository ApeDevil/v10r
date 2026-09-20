/**
 * Cache — the cheapest valid place to get an answer from.
 *
 * Three tiers, in the order a read tries them: process-local memory, shared Redis,
 * then the origin computation itself. Not every value uses every tier and none of
 * this is automatic — `tiered.ts` documents what a policy must declare before it is
 * allowed to store anything.
 *
 * `swr.ts` is the read path most callers want; `singleflight.ts` is what stops a
 * thousand simultaneous misses becoming a thousand identical rebuilds.
 */
export { redis } from './client';
// Public surface — see the note in `store/index.ts`; same shape, same reason.
export { CacheError, type CacheErrorKind, classifyCacheError } from './errors';
export { claimRefresh, coalesce, inFlightCount, RECLAIMABLE_AFTER_SECONDS } from './singleflight';
export { type CacheRead, readThrough } from './swr';
export {
	type CacheHit,
	type CachePolicy,
	type CacheScope,
	type CacheTier,
	cacheKey,
	clearLocalCache,
	definePolicy,
	LOCAL_MAX_ENTRIES,
	readTiered,
	writeTiered,
} from './tiered';
export * from './types';
