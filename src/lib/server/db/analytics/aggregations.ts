/**
 * Analytics aggregation queries — reads from rollup tables + computed aggregates.
 * These power the dashboard overview and breakdown views.
 */

import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import type {
	AudienceBreakdown,
	AudienceSplit,
	ConsentSplit,
	FrictionSignal,
	FunnelStep,
	OverviewMetrics,
	PageCount,
	TopPage,
	TrafficTrendPoint,
	TransitionRow,
	UserLaneStats,
	VitalSummary,
} from '$lib/server/analytics/types';
import { UNKNOWN_CLIENT, UNKNOWN_COUNTRY } from '$lib/server/analytics/types';
import { db } from '$lib/server/db';
import { dailyPageStats, events, sessions, userEvents } from '$lib/server/db/schema/analytics';

// ── Date helpers ─────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
	const d = new Date();
	d.setDate(d.getDate() - n);
	return d.toISOString().slice(0, 10);
}

function dateRange(days: number) {
	return { from: daysAgo(days), to: daysAgo(0) };
}

/**
 * Unwrap a `db.execute()` result into plain rows.
 *
 * The two drivers this codebase runs on disagree about the shape: the
 * `neon-serverless` pool used in production returns a pg `QueryResult`
 * (`{ rows, rowCount }`), while `pglite` — and the HTTP driver — hand back a
 * bare array. Casting straight to an array therefore type-checks and then
 * throws at runtime on whichever driver you did not test against, which is
 * exactly how a panel ends up permanently empty behind a `safeDeferPromise`
 * fallback instead of loudly failing.
 */
function rowsOf<T>(result: unknown): T[] {
	if (Array.isArray(result)) return result as T[];
	const rows = (result as { rows?: unknown })?.rows;
	return Array.isArray(rows) ? (rows as T[]) : [];
}

// ── Overview metrics ─────────────────────────────────────────────────────────

/**
 * Headline metrics for a date range.
 *
 * `uniqueVisitors` is counted from `sessions`, NOT summed out of the rollup.
 * `daily_page_stats.unique_visitors` is distinct-per-(date, path), so summing it
 * over a range multiplies each person by the number of pages they viewed on each
 * day they visited — a visitor who read three pages on two days scored six. Only
 * a distinct count over the whole window answers "how many people", and it has
 * to agree with `getAudienceBreakdown`, which is derived the same way.
 */
export async function getOverviewMetrics(days: number): Promise<OverviewMetrics> {
	const { from, to } = dateRange(days);

	const [rollup, visitors] = await Promise.all([
		db
			.select({
				totalPageviews: sql<number>`coalesce(sum(${dailyPageStats.pageviews}), 0)`,
				avgDuration: sql<number>`coalesce(avg(${dailyPageStats.avgDurationMs}), 0)`,
				avgBounce: sql<number>`coalesce(avg(${dailyPageStats.bounceRate}), 0)`,
			})
			.from(dailyPageStats)
			.where(and(gte(dailyPageStats.date, from), lte(dailyPageStats.date, to))),
		db
			.select({ uniqueVisitors: sql<number>`count(distinct ${sessions.visitorId})::int` })
			.from(sessions)
			.where(gte(sessions.startedAt, sql`${from}::date`)),
	]);

	const row = rollup[0];
	return {
		totalPageviews: Number(row?.totalPageviews ?? 0),
		uniqueVisitors: Number(visitors[0]?.uniqueVisitors ?? 0),
		avgSessionDuration: Math.round(Number(row?.avgDuration ?? 0)),
		bounceRate: Math.round(Number(row?.avgBounce ?? 0)),
	};
}

// ── Traffic trend ────────────────────────────────────────────────────────────

export async function getTrafficTrend(days: number): Promise<TrafficTrendPoint[]> {
	const { from, to } = dateRange(days);

	return db
		.select({
			date: dailyPageStats.date,
			pageviews: sql<number>`sum(${dailyPageStats.pageviews})`,
			uniqueVisitors: sql<number>`sum(${dailyPageStats.uniqueVisitors})`,
		})
		.from(dailyPageStats)
		.where(and(gte(dailyPageStats.date, from), lte(dailyPageStats.date, to)))
		.groupBy(dailyPageStats.date)
		.orderBy(dailyPageStats.date);
}

// ── Top pages ────────────────────────────────────────────────────────────────

export async function getTopPages(days: number, limit = 10): Promise<TopPage[]> {
	const { from, to } = dateRange(days);

	return db
		.select({
			path: dailyPageStats.path,
			pageviews: sql<number>`sum(${dailyPageStats.pageviews})`,
			uniqueVisitors: sql<number>`sum(${dailyPageStats.uniqueVisitors})`,
			avgDurationMs: sql<number | null>`avg(${dailyPageStats.avgDurationMs})::integer`,
			bounceRate: sql<number | null>`avg(${dailyPageStats.bounceRate})::integer`,
		})
		.from(dailyPageStats)
		.where(and(gte(dailyPageStats.date, from), lte(dailyPageStats.date, to)))
		.groupBy(dailyPageStats.path)
		.orderBy(desc(sql`sum(${dailyPageStats.pageviews})`))
		.limit(limit);
}

// ── Audience breakdown: who the visitors are ─────────────────────────────────

/**
 * Distinct visitors broken down by country, device class, and browser family.
 *
 * Counted per *visitor*, not per session. A session-level `GROUP BY country`
 * answers "where did the traffic come from"; this answers "where are the people
 * from", and the two differ by however many times each person came back.
 *
 * One `sessions` scan serves all three dimensions. The `visitor_dims` CTE folds
 * every visitor to a single row first, so a visitor with six sessions
 * contributes 1 to `visitors` and 6 to `sessions` — and, critically, cannot be
 * counted under two different countries. `max()` skips NULLs in Postgres, which
 * is what resolves the one case where a visitor's rows genuinely disagree: the
 * same person browsing before and after granting analytics consent has NULL
 * device on the earlier sessions and a real value on the later ones. Taking the
 * non-NULL value classifies them once, rather than splitting them across a real
 * bucket and `unknown`.
 *
 * No LIMIT: the dimensions are closed by construction — 2-letter country codes,
 * and the coarse device/browser families `classifyUserAgent` emits. There is no
 * user-controlled input here that could grow the row count.
 */
export async function getAudienceBreakdown(days: number): Promise<AudienceBreakdown> {
	// Same day boundary as getOverviewMetrics, so `totalVisitors` equals the
	// headline unique-visitor count instead of missing it by a partial day.
	const { from } = dateRange(days);

	const rows = await db.execute<{
		dimension: string;
		key: string;
		visitors: number;
		sessions: number;
	}>(sql`
		WITH visitor_dims AS (
			SELECT
				visitor_id,
				max(country) AS country,
				max(device)  AS device,
				max(browser) AS browser,
				count(*)     AS session_count
			FROM analytics.sessions
			WHERE started_at >= ${from}::date
			GROUP BY visitor_id
		)
		SELECT 'country' AS dimension, coalesce(country, ${UNKNOWN_COUNTRY}) AS key,
		       count(*)::int AS visitors, sum(session_count)::int AS sessions
		FROM visitor_dims GROUP BY 1, 2
		UNION ALL
		SELECT 'device', coalesce(device, ${UNKNOWN_CLIENT}),
		       count(*)::int, sum(session_count)::int
		FROM visitor_dims GROUP BY 1, 2
		UNION ALL
		SELECT 'browser', coalesce(browser, ${UNKNOWN_CLIENT}),
		       count(*)::int, sum(session_count)::int
		FROM visitor_dims GROUP BY 1, 2
		ORDER BY visitors DESC
	`);

	const all = rowsOf<{ dimension: string; key: string; visitors: number; sessions: number }>(rows);

	const pick = (dimension: string): AudienceSplit[] =>
		all
			.filter((r) => r.dimension === dimension)
			.map((r) => ({ key: r.key, visitors: Number(r.visitors), sessions: Number(r.sessions) }))
			.sort((a, b) => b.visitors - a.visitors);

	const countries = pick('country');
	const devices = pick('device');
	const browsers = pick('browser');

	const sum = (rowsIn: AudienceSplit[]) => rowsIn.reduce((acc, r) => acc + r.visitors, 0);
	const known = (rowsIn: AudienceSplit[], sentinel: string) =>
		rowsIn.filter((r) => r.key !== sentinel).reduce((acc, r) => acc + r.visitors, 0);

	return {
		countries,
		devices,
		browsers,
		totalVisitors: sum(countries),
		locatedVisitors: known(countries, UNKNOWN_COUNTRY),
		classifiedVisitors: known(devices, UNKNOWN_CLIENT),
	};
}

// ── Consent distribution ─────────────────────────────────────────────────────

export async function getConsentSplit(days: number): Promise<ConsentSplit[]> {
	const cutoff = new Date(Date.now() - days * 86400000);

	return db
		.select({
			tier: sessions.consentTier,
			count: sql<number>`count(*)`,
		})
		.from(sessions)
		.where(gte(sessions.startedAt, cutoff))
		.groupBy(sessions.consentTier)
		.orderBy(desc(sql`count(*)`))
		.limit(50);
}

// ── Funnel analysis ──────────────────────────────────────────────────────────

export async function getFunnelSteps(days: number, steps: { label: string; path: string }[]): Promise<FunnelStep[]> {
	const cutoff = new Date(Date.now() - days * 86400000);

	const paths = steps.map((s) => s.path);

	// Single query: count distinct sessions per path
	const rows = await db
		.select({
			path: events.path,
			count: sql<number>`count(distinct ${events.sessionId})`,
		})
		.from(events)
		.where(and(inArray(events.path, paths), eq(events.eventType, 'pageview'), gte(events.timestamp, cutoff)))
		.groupBy(events.path);

	// Map results back to ordered steps
	const countByPath = new Map(rows.map((r) => [r.path, Number(r.count)]));
	const results: FunnelStep[] = steps.map((step) => ({
		label: step.label,
		path: step.path,
		count: countByPath.get(step.path) ?? 0,
		rate: 0,
	}));

	// Calculate conversion rates relative to first step
	const topOfFunnel = results[0]?.count ?? 1;
	for (const step of results) {
		step.rate = topOfFunnel > 0 ? Math.round((step.count / topOfFunnel) * 100) : 0;
	}

	return results;
}

// ── Navigation paths ─────────────────────────────────────────────────────────

/**
 * Top page-to-page transitions, computed in Postgres with a window function.
 *
 * Replaces the retired Neo4j `FOLLOWED_BY` graph. The Sankey it used to feed is
 * gone deliberately: aggregate path diagrams merge visitors with opposite
 * experiences into one indistinguishable ribbon, so they look explanatory
 * without being able to answer "who, and why". A ranked transition table says
 * the same thing without implying more than the data supports.
 *
 * Self-transitions (a reload, or a beacon replay that slipped past the event-id
 * unique index) are excluded — they are not navigations.
 */
export async function getTopTransitions(days: number, limit = 20): Promise<TransitionRow[]> {
	const cutoff = new Date(Date.now() - days * 86400000);

	const rows = await db.execute<{ source: string; target: string; count: number }>(sql`
		SELECT source, target, count(*)::int AS count
		FROM (
			SELECT
				path AS source,
				LEAD(path) OVER (PARTITION BY session_id ORDER BY timestamp, id) AS target
			FROM analytics.events
			WHERE event_type = 'pageview' AND timestamp >= ${cutoff}
		) transitions
		WHERE target IS NOT NULL AND target <> source
		GROUP BY source, target
		ORDER BY count DESC
		LIMIT ${limit}
	`);

	return (rows as unknown as TransitionRow[]).map((r) => ({
		source: r.source,
		target: r.target,
		count: Number(r.count),
	}));
}

/** Where sessions began. Reads `sessions.entry_path` directly — no graph needed. */
export async function getEntryPages(days: number, limit = 10): Promise<PageCount[]> {
	const cutoff = new Date(Date.now() - days * 86400000);

	return db
		.select({ path: sessions.entryPath, count: sql<number>`count(*)::int` })
		.from(sessions)
		.where(gte(sessions.startedAt, cutoff))
		.groupBy(sessions.entryPath)
		.orderBy(desc(sql`count(*)`))
		.limit(limit);
}

/** Where sessions ended. Only meaningful now that the SPA beacon advances `exit_path`. */
export async function getExitPages(days: number, limit = 10): Promise<PageCount[]> {
	const cutoff = new Date(Date.now() - days * 86400000);

	return db
		.select({
			path: sql<string>`coalesce(${sessions.exitPath}, ${sessions.entryPath})`,
			count: sql<number>`count(*)::int`,
		})
		.from(sessions)
		.where(gte(sessions.startedAt, cutoff))
		.groupBy(sql`coalesce(${sessions.exitPath}, ${sessions.entryPath})`)
		.orderBy(desc(sql`count(*)`))
		.limit(limit);
}

// ── Web Vitals ───────────────────────────────────────────────────────────────

/**
 * Web Vitals at the 75th percentile, with the element most often blamed.
 *
 * p75 rather than the mean, deliberately: Google scores CWV at p75, and the mean
 * hides precisely the long tail of slow interactions that users actually notice.
 * `worstTarget` comes from the attribution build — it is what turns "INP is
 * 400ms" into "this button is 400ms", which is the difference between a number
 * and something you can act on.
 */
export async function getWebVitals(days: number): Promise<VitalSummary[]> {
	const cutoff = new Date(Date.now() - days * 86400000);

	const rows = await db.execute<{ metric: string; p75: number; samples: number; worst_target: string | null }>(sql`
		WITH samples AS (
			SELECT
				metadata->>'metric' AS metric,
				(metadata->>'value')::numeric AS value,
				metadata->>'target' AS target
			FROM analytics.events
			WHERE event_type = 'timing'
			  AND timestamp >= ${cutoff}
			  AND metadata->>'metric' IS NOT NULL
			  AND metadata->>'value' ~ '^[0-9]+(\\.[0-9]+)?$'
		),
		blame AS (
			SELECT DISTINCT ON (metric) metric, target
			FROM samples
			WHERE target IS NOT NULL
			GROUP BY metric, target
			ORDER BY metric, count(*) DESC
		)
		SELECT
			s.metric,
			percentile_cont(0.75) WITHIN GROUP (ORDER BY s.value) AS p75,
			count(*)::int AS samples,
			b.target AS worst_target
		FROM samples s
		LEFT JOIN blame b ON b.metric = s.metric
		GROUP BY s.metric, b.target
		ORDER BY s.metric
	`);

	return rowsOf<{ metric: string; p75: number; samples: number; worst_target: string | null }>(rows).map((r) => ({
		metric: r.metric,
		p75: Math.round(Number(r.p75) * 1000) / 1000,
		samples: Number(r.samples),
		worstTarget: r.worst_target,
	}));
}

// ── Friction signals ─────────────────────────────────────────────────────────

/**
 * Rage and dead clicks, grouped by what was clicked and where.
 *
 * These are the signals session replay is normally used to hunt for. Collected
 * in aggregate they answer the same question — where do people get stuck — with
 * none of the recording, consent-sampling bias, or PII-leak exposure.
 */
export async function getFrictionSignals(days: number, limit = 20): Promise<FrictionSignal[]> {
	const cutoff = new Date(Date.now() - days * 86400000);

	const rows = await db.execute<{ event: string; target: string; route: string; count: number }>(sql`
		SELECT
			metadata->>'event' AS event,
			metadata->>'target' AS target,
			coalesce(route, path) AS route,
			count(*)::int AS count
		FROM analytics.events
		WHERE event_type = 'action'
		  AND timestamp >= ${cutoff}
		  AND metadata->>'event' IN ('rage_click', 'dead_click')
		  AND metadata->>'target' IS NOT NULL
		GROUP BY 1, 2, 3
		ORDER BY count DESC
		LIMIT ${limit}
	`);

	return rowsOf<FrictionSignal>(rows).map((r) => ({
		event: r.event,
		target: r.target,
		route: r.route,
		count: Number(r.count),
	}));
}

// ── Authenticated lane ───────────────────────────────────────────────────────

/**
 * Usage of the authenticated area. Reads `analytics.user_events` — the lane the
 * consent banner does not govern, because for a logged-in user the ePrivacy gate
 * does not engage (TDDDG §25(2) Nr.2).
 */
export async function getUserLaneStats(days: number): Promise<UserLaneStats> {
	const cutoff = new Date(Date.now() - days * 86400000);

	const [totals, topRoutes] = await Promise.all([
		db
			.select({
				activeUsers: sql<number>`count(distinct ${userEvents.userId})::int`,
				events: sql<number>`count(*)::int`,
			})
			.from(userEvents)
			.where(gte(userEvents.timestamp, cutoff)),
		db
			.select({ route: userEvents.route, count: sql<number>`count(*)::int` })
			.from(userEvents)
			.where(gte(userEvents.timestamp, cutoff))
			.groupBy(userEvents.route)
			.orderBy(desc(sql`count(*)`))
			.limit(10),
	]);

	const row = totals[0];
	return {
		activeUsers: Number(row?.activeUsers ?? 0),
		events: Number(row?.events ?? 0),
		topRoutes: topRoutes.map((r) => ({ route: r.route, count: Number(r.count) })),
	};
}

// ── Data age stats (for privacy page) ────────────────────────────────────────

export async function getDataAgeStats() {
	const result = await db
		.select({
			totalEvents: sql<number>`count(*)`,
			oldestEvent: sql<string>`min(${events.timestamp})::text`,
			newestEvent: sql<string>`max(${events.timestamp})::text`,
			totalSessions: sql<number>`(SELECT count(*) FROM analytics.sessions)`,
		})
		.from(events);

	return result[0] ?? { totalEvents: 0, oldestEvent: null, newestEvent: null, totalSessions: 0 };
}
