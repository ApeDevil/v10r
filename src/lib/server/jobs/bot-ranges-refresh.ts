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
import { publishBotRanges } from '$lib/server/analytics';
import { BOT_RANGE_FEEDS, parsePrefixes } from '$lib/server/analytics/bot-ranges';
import { DATACENTER_RANGE_FEEDS } from '$lib/server/analytics/datacenter-ranges';
import { db } from '$lib/server/db';
import { botIpRanges } from '$lib/server/db/schema/analytics/bot-hits';
import { datacenterIpRanges } from '$lib/server/db/schema/analytics/dc-ranges';
import { type Deadline, startDeadline } from '$lib/server/http/deadline';

/** Generous but finite — these are small static documents on healthy CDNs. */
const FETCH_TIMEOUT_MS = 10_000;

/**
 * The datacenter documents are a different weight class — AWS is ~9k prefixes
 * and the iCloud relay CSV runs to megabytes — so they get their own timeout
 * and their inserts are chunked below the Postgres 65,535-parameter ceiling.
 */
const DC_FETCH_TIMEOUT_MS = 30_000;
const DC_INSERT_CHUNK = 5_000;

/**
 * Total budget for one run, under the cron route's `maxDuration: 60`.
 *
 * The per-fetch timeouts above bound one document; nothing bounded the SUM of them,
 * and ten feeds at 10–30s each is a worst case comfortably past sixty seconds. What
 * happened then was not a timeout but a kill: the platform ends the function, the
 * sources fetched so far are already committed, and the ones that were not appear
 * nowhere — no failure, no log line, just a job that quietly stopped doing half its
 * work. Bounding the whole run turns that into the outcome this file already knows
 * how to produce: the reachable sources refresh, the rest keep their previous rows,
 * and the runner is told which ones and why.
 */
const REFRESH_BUDGET_MS = 50_000;

/**
 * Budget held back from every fetch for the writes that follow them.
 *
 * A run that spent its last millisecond on the final document would have nothing left
 * to store it with, which is the one way to make bounding the run worse than not
 * bounding it.
 */
const WRITE_RESERVE_MS = 10_000;

async function fetchPrefixes(url: string, deadline: Deadline): Promise<string[]> {
	// Parsing lives inside the budget too: the timeout only covers the response
	// HEADERS, and a megabyte body arriving one slow chunk at a time is unbounded
	// otherwise. The signal aborts the stream, not just the connection.
	return deadline.child(FETCH_TIMEOUT_MS, { reserveMs: WRITE_RESERVE_MS }).run(async (signal) => {
		const response = await fetch(url, { signal, headers: { accept: 'application/json' } });
		if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);
		return parsePrefixes(await response.json());
	});
}

/** Datacenter feeds parse from raw text — CSV and bare-line formats included. */
async function fetchDcDocument(url: string, deadline: Deadline): Promise<string> {
	return deadline.child(DC_FETCH_TIMEOUT_MS, { reserveMs: WRITE_RESERVE_MS }).run(async (signal) => {
		const response = await fetch(url, { signal });
		if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);
		return response.text();
	});
}

export async function botRangesRefresh(): Promise<number> {
	const failures: string[] = [];
	// One budget for the run, divided among the feeds, rather than a fresh one each.
	const deadline = startDeadline(REFRESH_BUDGET_MS);

	for (const feed of BOT_RANGE_FEEDS) {
		let prefixes: string[];
		try {
			const lists = await Promise.all(feed.urls.map((url) => fetchPrefixes(url, deadline)));
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
		// The copy the request path verifies against. After Postgres, so the record is
		// never ahead of the projection; per source, so a failed feed keeps its old copy.
		await publishBotRanges(feed.source, prefixes);
	}

	// Datacenter / relay feeds (sessions.ip_class)
	//
	// Same per-source swap semantics as the crawler feeds above, and for the
	// same reason: a failed fetch keeps the previous rows, because an emptied
	// source silently downgrades every new session toward NULL/unknown.
	for (const feed of DATACENTER_RANGE_FEEDS) {
		let prefixes: string[];
		try {
			const documents = await Promise.all(feed.urls.map((url) => fetchDcDocument(url, deadline)));
			prefixes = [...new Set(documents.flatMap((doc) => feed.parse(doc)))];
		} catch (err) {
			failures.push(`${feed.source}: ${err instanceof Error ? err.message : String(err)}`);
			continue;
		}

		if (prefixes.length === 0) {
			failures.push(`${feed.source}: parsed 0 prefixes (feed shape may have changed)`);
			continue;
		}

		await db.transaction(async (tx) => {
			await tx.delete(datacenterIpRanges).where(eq(datacenterIpRanges.source, feed.source));
			for (let i = 0; i < prefixes.length; i += DC_INSERT_CHUNK) {
				await tx
					.insert(datacenterIpRanges)
					.values(prefixes.slice(i, i + DC_INSERT_CHUNK).map((prefix) => ({ source: feed.source, prefix })));
			}
		});
	}

	const [row] = await db.select({ total: sql<number>`count(*)::int` }).from(botIpRanges);
	const [dcRow] = await db.select({ total: sql<number>`count(*)::int` }).from(datacenterIpRanges);
	const total = Number(row?.total ?? 0) + Number(dcRow?.total ?? 0);

	// Throw AFTER the healthy sources have been written, so a partial outage still
	// refreshes everything it could and the runner records the failure with detail.
	if (failures.length > 0) {
		// Say which kind of incomplete it was. "Ran out of budget" and "the feed is down"
		// need different responses, and the failure list alone reads the same either way.
		const exhausted = deadline.expired() ? ' (run budget exhausted)' : '';
		throw new Error(`bot range refresh incomplete${exhausted} — ${failures.join('; ')}`);
	}
	return total;
}
