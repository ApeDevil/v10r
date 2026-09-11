/**
 * Stale-while-revalidate: answer now, refresh behind.
 *
 * The read path every cached value should use. It resolves in one of four ways and
 * the caller can tell which from `tier` and `stale`:
 *
 *   fresh hit         — inside its TTL, returned as-is.
 *   stale hit         — past TTL, inside the stale window. Returned IMMEDIATELY, with
 *                       a refresh started behind the response. The user's wait is not
 *                       the price of the value being current.
 *   miss              — computed, coalesced so a burst rebuilds once, then stored.
 *   stale-if-error    — the origin failed and a stale value exists. Serving it is
 *                       better than a 500 for anything whose staleness window says so.
 *
 * What must never be read through here: authorization decisions, account security
 * state, balances, or anything a destructive action validates against. A stale
 * permission is a wrong permission, and this module cannot tell the difference — the
 * call site can, which is why the policy lives there.
 *
 * The background refresh goes through `deferAfterResponse` rather than being left as
 * a dangling promise. On Vercel the instance can be frozen the moment the response
 * returns, and a refresh that is silently killed halfway leaves the value stale
 * forever while the logs stay clean.
 */
import { deferAfterResponse } from '$lib/server/platform';
import { claimRefresh, coalesce } from './singleflight';
import { type CacheKeyParts, type CachePolicy, type CacheTier, cacheKey, readTiered, writeTiered } from './tiered';

export interface CacheRead<T> {
	value: T;
	/** Which tier answered. `origin` means it was computed during this call. */
	tier: CacheTier;
	/** True when the value was served past its TTL. */
	stale: boolean;
	/** Age in seconds; 0 for a freshly computed value. */
	ageSeconds: number;
}

export async function readThrough<T>(
	policy: CachePolicy,
	parts: CacheKeyParts,
	compute: () => Promise<T>,
): Promise<CacheRead<T>> {
	const key = cacheKey(policy, parts);
	const hit = await readTiered<T>(policy, key);

	if (hit?.fresh) {
		return { value: hit.value, tier: hit.tier, stale: false, ageSeconds: hit.ageSeconds };
	}

	if (hit) {
		// Stale but servable. Refresh behind the response — and only if this instance
		// wins the claim, so N instances holding the same stale value produce one
		// refresh between them rather than N.
		deferAfterResponse(`cache:revalidate:${policy.namespace}`, async () => {
			if (!(await claimRefresh(key))) return;
			await coalesce(key, async () => {
				const value = await compute();
				await writeTiered(policy, key, value);
				return value;
			});
		});
		return { value: hit.value, tier: hit.tier, stale: true, ageSeconds: hit.ageSeconds };
	}

	// Cold. Nobody waits on a lock here — see singleflight's header for why. A throw
	// propagates on purpose: there is no stale value to fall back to, so the caller
	// asked for something that exists nowhere and an error is the only honest answer.
	// Stale-if-error is the branch above — a failing refresh leaves the stale value in
	// place until Redis expiry drops it, and readers keep being served meanwhile.
	const value = await coalesce(key, async () => {
		const computed = await compute();
		await writeTiered(policy, key, computed);
		return computed;
	});
	return { value, tier: 'origin', stale: false, ageSeconds: 0 };
}
