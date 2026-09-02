/**
 * Move buffered crawler hits from Redis into `analytics.bot_hits`.
 *
 * First in the due-jobs sequence: `analytics-cleanup` and the retention sweeps run
 * after it, so a flushed row is subject to the same windows as one written the old way.
 * The admin bots page drains the same buffer on view, so the daily run is the floor on
 * freshness, not the ceiling. Returns the number of entries flushed.
 */

import { flushBotHits } from '$lib/server/analytics';

export async function botHitsFlush(): Promise<number> {
	return flushBotHits();
}
