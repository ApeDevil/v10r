/**
 * The cache hierarchy: where a value may live, and who is allowed to read it back.
 *
 * A read walks outward from the cheapest tier — process-local memory, then shared
 * Redis, then the origin computation. `swr.ts` owns that walk; this module owns the
 * two things that make it safe to store anything at all:
 *
 *   KEY IDENTITY. A key must encode every input that changes the answer, or the cache
 *   serves one caller's result to another. That is not a performance bug, it is a data
 *   leak, so `cacheKey` refuses a per-user policy with no owner AND a shared policy
 *   that was handed one — the second is the more dangerous mistake, because it silently
 *   parks a personal value under a key everyone reads.
 *
 *   FRESHNESS OWNERSHIP. `ttl` is how long a value is the truth; `staleFor` is how much
 *   longer it may be served while a refresh runs behind it. Both live on the policy,
 *   next to the namespace they govern, because a staleness window argued at each call
 *   site is a staleness window nobody can state.
 *
 * The stored envelope carries its own `ttl` rather than relying on Redis expiry alone.
 * Redis expiry is a floor (it reclaims memory); the envelope is what decides *fresh*,
 * and it has to survive the value being read out of the local tier where Redis TTL
 * does not exist. Per-key jitter is applied there so a burst of keys written together
 * does not expire together — synchronised expiry is how a cache becomes a stampede.
 *
 * With no Redis configured every shared read is a miss and every write is a no-op. A
 * miss is always correct, only slower, which is why this degrades silently where the
 * rate limiter — guarding something that breaks when unbounded — must not.
 */
import { redis } from './client';

/** Which tier answered a read. `origin` means nothing was cached and it was computed. */
export type CacheTier = 'local' | 'shared' | 'origin';

/**
 * Who a namespace's values belong to.
 *
 * `shared` — the same answer for everybody (a public page, a site-wide aggregate).
 * `per-user` — one answer per owner; the owner is part of the key, always.
 */
export type CacheScope = 'shared' | 'per-user';

export interface CachePolicy {
	/** First key segment. One namespace per kind of value, never per call site. */
	namespace: string;
	/** Seconds the value is fresh. */
	ttl: number;
	/** Extra seconds it may be served stale while a refresh runs. 0 disables SWR for this policy. */
	staleFor: number;
	scope: CacheScope;
	/**
	 * Keep values in this process's memory as well as Redis.
	 *
	 * Defaults to false for `per-user` policies. The local tier is correct there — keys
	 * carry the owner — but a warm serverless instance would accumulate one entry per
	 * user it happened to serve, which is memory pressure bought for a hit rate that
	 * personal data rarely has. Opt in when a per-user value is genuinely re-read
	 * within one request.
	 */
	local: boolean;
	/** Fraction of `ttl` to jitter each write by, 0–1. Keeps sibling keys from expiring together. */
	jitter: number;
}

export interface CacheHit<T> {
	value: T;
	tier: Exclude<CacheTier, 'origin'>;
	ageSeconds: number;
	/** False when the value is inside its stale window rather than its TTL. */
	fresh: boolean;
}

/** Ceiling on process-local entries across every policy. Oldest-used evicted first. */
export const LOCAL_MAX_ENTRIES = 500;

const DEFAULT_JITTER = 0.1;

interface Envelope<T> {
	v: T;
	/** Epoch ms the value was computed. */
	at: number;
	/** Jittered freshness horizon in seconds — see the header. */
	ttl: number;
}

/** Insertion-ordered, so the oldest key is always the first one `keys()` yields. */
const localTier = new Map<string, Envelope<unknown>>();

/** Test seam. Nothing in the request path clears the whole tier. */
export function clearLocalCache(): void {
	localTier.clear();
}

/**
 * Complete a policy from the few fields worth stating at a call site.
 *
 * `staleFor: 0` is the explicit "no stale reads" choice and stays the default: serving
 * a stale value is a decision about correctness, not an optimisation to inherit.
 */
export function definePolicy(
	policy: Pick<CachePolicy, 'namespace' | 'ttl' | 'scope'> & Partial<CachePolicy>,
): CachePolicy {
	if (!/^[a-z0-9][a-z0-9-]*$/.test(policy.namespace)) {
		throw new Error(`cache namespace must be kebab-case: '${policy.namespace}'`);
	}
	if (policy.ttl <= 0) {
		throw new Error(`cache policy '${policy.namespace}' needs a positive ttl`);
	}
	return {
		staleFor: 0,
		local: policy.scope === 'shared',
		jitter: DEFAULT_JITTER,
		...policy,
	};
}

export interface CacheKeyParts {
	/** Everything that changes the answer, beyond the owner. */
	id: string;
	/** Required for `per-user`, forbidden for `shared`. */
	owner?: string;
}

/**
 * Build the one key a value may be stored under.
 *
 * The `cache:` prefix keeps these away from the hand-rolled key families (`rl:`,
 * `ai:budget:`, `stepup:`, `showcase:`) so an admin looking at Redis can tell what
 * wrote a key from the key alone.
 */
export function cacheKey(policy: CachePolicy, parts: CacheKeyParts): string {
	if (policy.scope === 'per-user' && !parts.owner) {
		throw new Error(`cache '${policy.namespace}' is per-user — a key without an owner would be read by everyone`);
	}
	if (policy.scope === 'shared' && parts.owner) {
		throw new Error(`cache '${policy.namespace}' is shared — an owner here means the scope is wrong, not the key`);
	}
	return `cache:${policy.namespace}:${parts.owner ?? '*'}:${parts.id}`;
}

function classify<T>(
	policy: CachePolicy,
	envelope: Envelope<T>,
	tier: Exclude<CacheTier, 'origin'>,
): CacheHit<T> | null {
	const ageSeconds = (Date.now() - envelope.at) / 1000;
	if (ageSeconds > envelope.ttl + policy.staleFor) return null;
	return { value: envelope.v, tier, ageSeconds, fresh: ageSeconds <= envelope.ttl };
}

/** Read a key from the local tier, then the shared tier. `null` = nothing servable. */
export async function readTiered<T>(policy: CachePolicy, key: string): Promise<CacheHit<T> | null> {
	if (policy.local) {
		const local = localTier.get(key) as Envelope<T> | undefined;
		if (local) {
			const hit = classify(policy, local, 'local');
			if (hit) {
				// Re-insert so the entry moves to the young end of the eviction order.
				localTier.delete(key);
				localTier.set(key, local);
				return hit;
			}
			localTier.delete(key);
		}
	}

	if (!redis) return null;
	const shared = (await redis.get<Envelope<T>>(key).catch(() => null)) ?? null;
	if (!shared || typeof shared.at !== 'number') return null;

	const hit = classify(policy, shared, 'shared');
	// Promote into the local tier even when stale: `swr` still wants to serve it, and
	// re-reading Redis for the same stale value on the next request buys nothing.
	if (hit && policy.local) rememberLocally(key, shared);
	return hit;
}

function rememberLocally<T>(key: string, envelope: Envelope<T>): void {
	localTier.delete(key);
	localTier.set(key, envelope);
	while (localTier.size > LOCAL_MAX_ENTRIES) {
		const oldest = localTier.keys().next();
		if (oldest.done) break;
		localTier.delete(oldest.value);
	}
}

export async function writeTiered<T>(policy: CachePolicy, key: string, value: T): Promise<void> {
	const spread = policy.ttl * policy.jitter;
	const envelope: Envelope<T> = {
		v: value,
		at: Date.now(),
		ttl: Math.max(1, Math.round(policy.ttl - spread / 2 + Math.random() * spread)),
	};

	if (policy.local) rememberLocally(key, envelope);
	if (!redis) return;

	// Redis expiry covers the whole servable life — TTL plus the stale window — because
	// a value Redis has already dropped cannot be served stale, and stale-if-error is
	// exactly the case where the origin cannot replace it.
	await redis
		.set(key, envelope, { ex: envelope.ttl + policy.staleFor })
		.catch((err) => console.error(`[cache] write failed for ${key}:`, err));
}

/** Invalidate one key in both tiers. Takes the built key — it already carries the policy. */
export async function dropTiered(key: string): Promise<void> {
	localTier.delete(key);
	if (!redis) return;
	await redis.del(key).catch((err) => console.error(`[cache] drop failed for ${key}:`, err));
}
