/**
 * Read side of the bot lane.
 *
 * Query-builder only, no `db.execute()` — the neon-serverless pool returns
 * `{ rows }` while PGlite returns a bare array, so a hand-rolled execute
 * type-checks and then returns nothing on the driver you did not test. That is
 * exactly how two panels on the analytics dashboard ended up silently empty.
 *
 * One rule every query here obeys: `family` is NEVER shown without
 * `verification`. The User-Agent is free text, so an unqualified "GPTBot: 400
 * hits" is a claim, not a measurement.
 */

import { and, count, desc, eq, gte, isNotNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { botHits, botIpRanges } from '$lib/server/db/schema/analytics/bot-hits';

function cutoff(days: number): Date {
	return new Date(Date.now() - days * 86400000);
}

export interface BotFamilyRow {
	family: string;
	category: string;
	hits: number;
	verified: number;
	spoofed: number;
	unpublished: number;
	unchecked: number;
	lastSeen: Date | null;
}

/**
 * Who is crawling, and whether they are who they say.
 *
 * The verification columns sit beside the total rather than filtering it, so a
 * family that is 90% impersonation is visible as such instead of quietly
 * inflating an adoption number.
 */
export async function getBotFamilies(days: number): Promise<BotFamilyRow[]> {
	const rows = await db
		.select({
			family: botHits.family,
			category: botHits.category,
			hits: count(),
			verified: sql<number>`count(*) FILTER (WHERE ${botHits.verification} = 'verified')::int`,
			spoofed: sql<number>`count(*) FILTER (WHERE ${botHits.verification} = 'spoofed')::int`,
			unpublished: sql<number>`count(*) FILTER (WHERE ${botHits.verification} = 'unpublished')::int`,
			unchecked: sql<number>`count(*) FILTER (WHERE ${botHits.verification} = 'unchecked')::int`,
			lastSeen: sql<Date | null>`max(${botHits.timestamp})`,
		})
		.from(botHits)
		.where(gte(botHits.timestamp, cutoff(days)))
		.groupBy(botHits.family, botHits.category)
		.orderBy(desc(count()))
		.limit(50);

	return rows.map((r) => ({
		family: r.family,
		category: r.category,
		hits: Number(r.hits),
		verified: Number(r.verified),
		spoofed: Number(r.spoofed),
		unpublished: Number(r.unpublished),
		unchecked: Number(r.unchecked),
		lastSeen: r.lastSeen ? new Date(r.lastSeen) : null,
	}));
}

/** Volume by purpose — the axis operator decisions are made on. */
export async function getBotCategories(days: number) {
	const rows = await db
		.select({ category: botHits.category, hits: count() })
		.from(botHits)
		.where(gte(botHits.timestamp, cutoff(days)))
		.groupBy(botHits.category)
		.orderBy(desc(count()));
	return rows.map((r) => ({ category: r.category, hits: Number(r.hits) }));
}

/**
 * THE AX PANEL: which agents fetch the surfaces built for agents.
 *
 * Rides the partial `bot_hits_agent_surface_idx`, so scanner noise cannot slow it
 * down no matter how much of it arrives.
 */
export async function getAgentSurfaceHits(days: number) {
	const rows = await db
		.select({
			path: botHits.path,
			family: botHits.family,
			hits: count(),
			lastSeen: sql<Date | null>`max(${botHits.timestamp})`,
		})
		.from(botHits)
		.where(and(gte(botHits.timestamp, cutoff(days)), eq(botHits.agentSurface, true), isNotNull(botHits.path)))
		.groupBy(botHits.path, botHits.family)
		.orderBy(desc(count()))
		.limit(30);

	return rows.map((r) => ({
		path: r.path ?? '—',
		family: r.family,
		hits: Number(r.hits),
		lastSeen: r.lastSeen ? new Date(r.lastSeen) : null,
	}));
}

/**
 * Where non-human traffic got a 4xx/5xx.
 *
 * Two different findings share this panel and the path tells them apart: probes
 * for software this site does not run (`/wp-login.php`) are scanners, while 404s
 * on plausible URLs are usually a stale sitemap or a broken inbound link.
 */
export async function getBotMisses(days: number, limit = 20) {
	const rows = await db
		.select({
			path: botHits.path,
			status: botHits.status,
			family: botHits.family,
			hits: count(),
		})
		.from(botHits)
		.where(and(gte(botHits.timestamp, cutoff(days)), gte(botHits.status, 400), isNotNull(botHits.path)))
		.groupBy(botHits.path, botHits.status, botHits.family)
		.orderBy(desc(count()))
		.limit(limit);

	return rows.map((r) => ({ path: r.path ?? '—', status: r.status, family: r.family, hits: Number(r.hits) }));
}

/** Daily volume, split human-adjacent vs machine, for the trend chart. */
export async function getBotTrend(days: number) {
	const day = sql`(${botHits.timestamp} AT TIME ZONE 'UTC')::date`;
	const rows = await db
		.select({
			date: sql<string>`${day}::text`,
			hits: sql<number>`count(*)::int`,
			ai: sql<number>`count(*) FILTER (WHERE ${botHits.category} IN ('ai_training','ai_search','ai_agent'))::int`,
		})
		.from(botHits)
		.where(gte(botHits.timestamp, cutoff(days)))
		.groupBy(day)
		.orderBy(day);
	return rows.map((r) => ({ date: r.date, hits: Number(r.hits), ai: Number(r.ai) }));
}

/**
 * Freshness of the verification data itself.
 *
 * Without this the panel cannot tell "nobody is impersonating anyone" apart from
 * "the refresh job has never run", and those two states look identical in every
 * other number on the page.
 */
export async function getBotRangeStatus() {
	const rows = await db
		.select({
			source: botIpRanges.source,
			prefixes: count(),
			fetchedAt: sql<Date | null>`max(${botIpRanges.fetchedAt})`,
		})
		.from(botIpRanges)
		.groupBy(botIpRanges.source)
		.orderBy(botIpRanges.source);

	return rows.map((r) => ({
		source: r.source,
		prefixes: Number(r.prefixes),
		fetchedAt: r.fetchedAt ? new Date(r.fetchedAt) : null,
	}));
}
