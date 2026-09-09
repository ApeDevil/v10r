/**
 * Stampede protection: many misses for the same value, one rebuild.
 *
 * The shape of the problem is that a cache expiry is a synchronised event. A
 * thousand requests arriving after it do not find a slow cache — they find no
 * cache, and each one independently rebuilds the same value against the same
 * upstream, at the moment that upstream is least able to take it.
 *
 * Two mechanisms, deliberately different in what they promise:
 *
 *   `coalesce` — in-process. Concurrent callers for one key share one promise. This
 *   is where the thousand-to-one collapse actually happens, because a burst lands on
 *   an instance, not on a cluster.
 *
 *   `claimRefresh` — cross-instance. One instance wins the right to refresh a key and
 *   the others do not bother. It is used ONLY on the stale-while-revalidate path,
 *   where losing means "someone else is refreshing, keep serving stale" — never on a
 *   cold miss.
 *
 * That restriction is the design, not a limitation. A lock that a cold caller waits
 * on turns a slow dependency into a queue and one failed leader into an outage; the
 * invariant "stampede protection must not introduce unbounded waiting" is satisfied
 * here by never making anyone wait at all. A loser with nothing to serve computes,
 * and duplicate work beats a stalled request.
 *
 * The lock always carries an expiry, so a leader that dies mid-refresh blocks the
 * next refresh for at most `RECLAIMABLE_AFTER_SECONDS` rather than forever.
 */
import { redis } from './client';

/** How long a refresh claim is held before another instance may take it. */
export const RECLAIMABLE_AFTER_SECONDS = 30;

const inFlight = new Map<string, Promise<unknown>>();

/**
 * Share one execution of `work` among every concurrent caller for `key`.
 *
 * Followers get the leader's result — including its rejection, so nobody silently
 * receives a different answer than the caller that did the work. The entry is dropped
 * on settle rather than cached: this deduplicates, it does not memoize.
 */
export function coalesce<T>(key: string, work: () => Promise<T>): Promise<T> {
	const existing = inFlight.get(key) as Promise<T> | undefined;
	if (existing) return existing;

	const started = (async () => work())().finally(() => {
		inFlight.delete(key);
	});
	inFlight.set(key, started);
	return started;
}

/** Concurrent keys currently being computed. Diagnostics and tests only. */
export function inFlightCount(): number {
	return inFlight.size;
}

/**
 * Try to become the instance that refreshes `key`.
 *
 * `true` means go ahead; `false` means another instance already is. With no Redis
 * configured every caller wins — there is no shared state to coordinate through, and
 * in-process `coalesce` still collapses the burst on this instance.
 */
export async function claimRefresh(key: string, holdSeconds = RECLAIMABLE_AFTER_SECONDS): Promise<boolean> {
	if (!redis) return true;
	try {
		// NX + EX in one command: a separate SET and EXPIRE would leave an eternal lock
		// behind whenever the process dies between them.
		const claimed = await redis.set(`refresh:${key}`, Date.now(), { nx: true, ex: holdSeconds });
		return claimed === 'OK';
	} catch (err) {
		// A Redis failure must not stop the refresh — the value would go on ageing with
		// nobody allowed to renew it.
		console.error(`[singleflight] claim failed for ${key}:`, err);
		return true;
	}
}
