/**
 * Refresh the published crawler IP prefixes that back `bot_hits.verification`.
 *
 * ## Replace per SOURCE, never globally
 *
 * Each source is swapped in its own transaction and only when its fetch actually
 * succeeded. A naive "delete everything, insert what we fetched" would, on a
 * single failed request, silently downgrade every subsequent hit for that
 * operator from `verified` to `spoofed` — turning a transient network blip into a
 * dashboard full of fake impersonation alerts. Stale prefixes are far less
 * harmful than absent ones, so a failing feed keeps its previous rows.
 *
 * ## Returns
 *
 * The number of prefixes now stored across all sources — not the number changed.
 * These lists are near-static, so a "rows written" count would read as 0 on a
 * perfectly healthy run and look like a broken job.
 */

import { eq, sql } from 'drizzle-orm';
import { BOT_RANGE_FEEDS, parsePrefixes } from '$lib/server/analytics/bot-ranges';
import { db } from '$lib/server/db';
import { botIpRanges } from '$lib/server/db/schema/analytics/bot-hits';

/** Generous but finite — these are small static documents on healthy CDNs. */
const FETCH_TIMEOUT_MS = 10_000;

async function fetchPrefixes(url: string): Promise<string[]> {
	const response = await fetch(url, {
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		headers: { accept: 'application/json' },
	});
	if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);
	return parsePrefixes(await response.json());
}

export async function botRangesRefresh(): Promise<number> {
	const failures: string[] = [];

	for (const feed of BOT_RANGE_FEEDS) {
		let prefixes: string[];
		try {
			const lists = await Promise.all(feed.urls.map(fetchPrefixes));
			// One source can be backed by several documents (OpenAI publishes one per
			// crawler), and they may overlap. Dedupe before the unique constraint has
			// to care.
			prefixes = [...new Set(lists.flat())];
		} catch (err) {
			failures.push(`${feed.source}: ${err instanceof Error ? err.message : String(err)}`);
			continue;
		}

		// An empty list from a 200 means the shape changed under us. Treat it as a
		// failure rather than wiping a working source — this is the case that would
		// otherwise flip every hit for that operator to `spoofed`.
		if (prefixes.length === 0) {
			failures.push(`${feed.source}: parsed 0 prefixes (feed shape may have changed)`);
			continue;
		}

		await db.transaction(async (tx) => {
			await tx.delete(botIpRanges).where(eq(botIpRanges.source, feed.source));
			await tx.insert(botIpRanges).values(prefixes.map((prefix) => ({ source: feed.source, prefix })));
		});
	}

	const [row] = await db.select({ total: sql<number>`count(*)::int` }).from(botIpRanges);
	const total = Number(row?.total ?? 0);

	// Throw AFTER the healthy sources have been written, so a partial outage still
	// refreshes everything it could and the runner records the failure with detail.
	if (failures.length > 0) throw new Error(`bot range refresh incomplete — ${failures.join('; ')}`);
	return total;
}
