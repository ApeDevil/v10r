/**
 * Analytics aggregation queries — reads from rollup tables + computed aggregates.
 * These power the dashboard overview and breakdown views.
 */

import { and, desc, eq, gte, inArray, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import type {
	AudienceBreakdown,
	AudienceSplit,
	ConsentSplit,
	FrictionSignal,
	FunnelStep,
	OverviewMetrics,
	PageCount,
	TopPage,
	TrafficComposition,
	TrafficTrendPoint,
	TransitionRow,
	UserLaneStats,
	VitalSummary,
} from '$lib/server/analytics/types';
import { db } from '$lib/server/db';
import { getBotCategories } from '$lib/server/db/analytics/bot-queries';
import { UNKNOWN_CLIENT, UNKNOWN_COUNTRY } from '$lib/server/db/analytics/constants';
import { rowsOf } from '$lib/server/db/rows';
import { dailyPageStats, events, sessions, userEvents } from '$lib/server/db/schema/analytics';

function daysAgo(n: number): string {
	const d = new Date();
	d.setDate(d.getDate() - n);
	return d.toISOString().slice(0, 10);
}

function dateRange(days: number) {
	return { from: daysAgo(days), to: daysAgo(0) };
}

/**
 * Headline metrics for a date range — CONFIRMED sessions only, with the
 * unconfirmed remainder carried alongside.
 *
 * Volume is counted from RAW events, not from the rollup: reading pageviews out
 * of `daily_page_stats` once made the headline a function of when the rollup
 * last ran (it froze for four days in 2026-07/08). The join to `sessions` is
 * INNER on purpose, matching the live feed and the rollup — an orphan event
 * (no session row) is invisible everywhere, consistently.
 *
 * `uniqueVisitors` is a distinct count over the whole window, never a sum of
 * per-day counts (summing multiplies returning visitors), and it has to agree
 * with `getAudienceBreakdown`, which now filters to confirmed the same way.
 */
export async function getOverviewMetrics(days: number): Promise<OverviewMetrics> {
	const { from, to } = dateRange(days);

	const [rollup, live] = await Promise.all([
		// Engagement-derived metrics ONLY. Both need the client's visibility-aware
		// clock joined per (session, path), which is exactly the work the rollup
		// exists to precompute — so these two, and only these two, are allowed to be
		// as stale as the last rollup run. Confirmed-only by construction now that
		// the rollup's engagement columns are computed over confirmed sessions.
		db
			.select({
				avgDuration: sql<number>`coalesce(avg(${dailyPageStats.avgDurationMs}), 0)`,
				avgBounce: sql<number>`coalesce(avg(${dailyPageStats.bounceRate}), 0)`,
			})
			.from(dailyPageStats)
			.where(and(gte(dailyPageStats.date, from), lte(dailyPageStats.date, to))),
		db
			.select({
				confirmedPageviews: sql<number>`count(*) FILTER (WHERE ${sessions.humanConfirmedAt} IS NOT NULL)::int`,
				confirmedVisitors: sql<number>`count(distinct ${events.visitorId}) FILTER (WHERE ${sessions.humanConfirmedAt} IS NOT NULL)::int`,
				unconfirmedPageviews: sql<number>`count(*) FILTER (WHERE ${sessions.humanConfirmedAt} IS NULL)::int`,
				unconfirmedVisitors: sql<number>`count(distinct ${events.visitorId}) FILTER (WHERE ${sessions.humanConfirmedAt} IS NULL)::int`,
			})
			.from(events)
			.innerJoin(sessions, eq(events.sessionId, sessions.id))
			// The operator's own tagged traffic is not audience. Excluded on the
			// immutable event-side tag, not the session-side pairing column the
			// reaper clears after 2h.
			.where(
				and(
					eq(events.eventType, 'pageview'),
					gte(events.timestamp, sql`${from}::date`),
					isNull(events.debugOwnerId),
					isNull(sessions.debugOwnerId),
				),
			),
	]);

	const row = rollup[0];
	return {
		totalPageviews: Number(live[0]?.confirmedPageviews ?? 0),
		uniqueVisitors: Number(live[0]?.confirmedVisitors ?? 0),
		avgSessionDuration: Math.round(Number(row?.avgDuration ?? 0)),
		bounceRate: Math.round(Number(row?.avgBounce ?? 0)),
		unconfirmedPageviews: Number(live[0]?.unconfirmedPageviews ?? 0),
		unconfirmedVisitors: Number(live[0]?.unconfirmedVisitors ?? 0),
	};
}

/**
 * How current the rollup is — `max(date)` in `daily_page_stats`, or null if empty.
 *
 * Exists because the failure that motivated it was SILENT: the rollup job stopped
 * running on 2026-07-31 and every panel fed by it kept rendering its last value
 * with no indication the data had stopped moving. A dashboard that cannot say how
 * old it is will present stale numbers as current indefinitely.
 */
export async function getRollupFreshness(): Promise<string | null> {
	const rows = await db.select({ latest: sql<string | null>`max(${dailyPageStats.date})::text` }).from(dailyPageStats);
	return rows[0]?.latest ?? null;
}

/**
 * CONFIRMED pageviews and unique visitors per day.
 *
 * ## Why this does not read the rollup
 *
 * `sum(daily_page_stats.unique_visitors) GROUP BY date` is unsound for the same
 * reason `getOverviewMetrics` documents: the rollup's `unique_visitors` is
 * distinct-per-(date, path), so summing it over a day multiplies every person by
 * the number of distinct pages they viewed — and since the headline KPI counts
 * correctly, the chart would disagree with the number directly above it.
 *
 * A per-day distinct count cannot be assembled from a per-path rollup at all; the
 * only correct source is the raw events. Reading them here also decouples the
 * chart from the rollup job, so a missed cron run leaves a gap in the engagement
 * metrics rather than silently flat-lining traffic.
 */
export async function getTrafficTrend(days: number): Promise<TrafficTrendPoint[]> {
	const { from } = dateRange(days);

	// Bound to UTC explicitly: `date` in the rollup is a UTC calendar date, and an
	// unqualified ::date cast would bucket by the server's zone instead, quietly
	// shifting every point by up to a day relative to every other panel.
	const day = sql`(${events.timestamp} AT TIME ZONE 'UTC')::date`;

	return db
		.select({
			date: sql<string>`${day}::text`,
			pageviews: sql<number>`count(*)::int`,
			uniqueVisitors: sql<number>`count(distinct ${events.visitorId})::int`,
		})
		.from(events)
		.innerJoin(sessions, eq(events.sessionId, sessions.id))
		.where(
			and(
				gte(events.timestamp, sql`${from}::date`),
				eq(events.eventType, 'pageview'),
				isNotNull(sessions.humanConfirmedAt),
				isNull(events.debugOwnerId),
				isNull(sessions.debugOwnerId),
			),
		)
		.groupBy(day)
		.orderBy(day);
}

/**
 * Confirmed pageviews per path (the rollup's headline columns are confirmed-
 * only). Deliberately NO unique-visitors column: summing the rollup's per-day
 * distinct counts across a range re-counts every returning visitor — the
 * documented error the KPI and trend chart were already cured of.
 */
export async function getTopPages(days: number, limit = 10): Promise<TopPage[]> {
	const { from, to } = dateRange(days);

	return db
		.select({
			path: dailyPageStats.path,
			pageviews: sql<number>`sum(${dailyPageStats.pageviews})`,
			avgDurationMs: sql<number | null>`avg(${dailyPageStats.avgDurationMs})::integer`,
			bounceRate: sql<number | null>`avg(${dailyPageStats.bounceRate})::integer`,
		})
		.from(dailyPageStats)
		.where(and(gte(dailyPageStats.date, from), lte(dailyPageStats.date, to)))
		.groupBy(dailyPageStats.path)
		.orderBy(desc(sql`sum(${dailyPageStats.pageviews})`))
		.limit(limit);
}

// Audience breakdown: who the visitors are

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
			  AND human_confirmed_at IS NOT NULL
			  AND debug_owner_id IS NULL
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

export async function getConsentSplit(days: number): Promise<ConsentSplit[]> {
	const cutoff = new Date(Date.now() - days * 86400000);

	return (
		db
			.select({
				tier: sessions.consentTier,
				count: sql<number>`count(*)`,
			})
			.from(sessions)
			// Confirmed sessions only: a consent rate computed over crawler sessions
			// (which never see the banner, let alone accept it) reads as a collapse.
			.where(and(gte(sessions.startedAt, cutoff), isNotNull(sessions.humanConfirmedAt), isNull(sessions.debugOwnerId)))
			.groupBy(sessions.consentTier)
			.orderBy(desc(sql`count(*)`))
			.limit(50)
	);
}

// Traffic composition: the three honestly-labelled buckets

/**
 * Confirmed / unconfirmed / bots, for the composition panel.
 *
 * The bot side is HITS from `bot_hits` — that table carries no visitor identity
 * by design, so it can never be a visitor count and the panel must not imply
 * one. The ip_class split ranks the unconfirmed bucket only; per the schema
 * doc, it must never become an exclusion predicate (its false positives are
 * VPN and Private Relay users — real people).
 */
export async function getTrafficComposition(days: number): Promise<TrafficComposition> {
	const { from } = dateRange(days);

	const [eventRows, botCategories] = await Promise.all([
		db.execute<{
			confirmed_pv: number;
			confirmed_visitors: number;
			unconfirmed_pv: number;
			unconfirmed_visitors: number;
			unc_datacenter: number;
			unc_relay: number;
			unc_unclassified: number;
		}>(sql`
			SELECT
				count(*) FILTER (WHERE s.human_confirmed_at IS NOT NULL)::int AS confirmed_pv,
				count(DISTINCT e.visitor_id) FILTER (WHERE s.human_confirmed_at IS NOT NULL)::int AS confirmed_visitors,
				count(*) FILTER (WHERE s.human_confirmed_at IS NULL)::int AS unconfirmed_pv,
				count(DISTINCT e.visitor_id) FILTER (WHERE s.human_confirmed_at IS NULL)::int AS unconfirmed_visitors,
				count(DISTINCT e.visitor_id) FILTER (
					WHERE s.human_confirmed_at IS NULL AND s.ip_class = 'datacenter')::int AS unc_datacenter,
				count(DISTINCT e.visitor_id) FILTER (
					WHERE s.human_confirmed_at IS NULL AND s.ip_class = 'icloud_relay')::int AS unc_relay,
				count(DISTINCT e.visitor_id) FILTER (
					WHERE s.human_confirmed_at IS NULL
					  AND (s.ip_class = 'unknown' OR s.ip_class IS NULL))::int AS unc_unclassified
			FROM analytics.events e
			JOIN analytics.sessions s ON s.id = e.session_id
			WHERE e.event_type = 'pageview'
			  AND e.timestamp >= ${from}::date
			  AND e.debug_owner_id IS NULL
			  AND s.debug_owner_id IS NULL
		`),
		getBotCategories(days),
	]);

	const row = rowsOf<{
		confirmed_pv: number;
		confirmed_visitors: number;
		unconfirmed_pv: number;
		unconfirmed_visitors: number;
		unc_datacenter: number;
		unc_relay: number;
		unc_unclassified: number;
	}>(eventRows)[0];

	const byCategory = botCategories.map((c) => ({ category: c.category, hits: Number(c.hits) }));

	return {
		confirmed: {
			pageviews: Number(row?.confirmed_pv ?? 0),
			visitors: Number(row?.confirmed_visitors ?? 0),
		},
		unconfirmed: {
			pageviews: Number(row?.unconfirmed_pv ?? 0),
			visitors: Number(row?.unconfirmed_visitors ?? 0),
			byIpClass: {
				datacenter: Number(row?.unc_datacenter ?? 0),
				icloudRelay: Number(row?.unc_relay ?? 0),
				unclassified: Number(row?.unc_unclassified ?? 0),
			},
		},
		bots: {
			hits: byCategory.reduce((acc, c) => acc + c.hits, 0),
			aiMediatedHits: byCategory.find((c) => c.category === 'ai_agent')?.hits ?? 0,
			byCategory,
		},
	};
}

export async function getFunnelSteps(days: number, steps: { label: string; path: string }[]): Promise<FunnelStep[]> {
	const cutoff = new Date(Date.now() - days * 86400000);

	const paths = steps.map((s) => s.path);

	// Single query: count distinct CONFIRMED sessions per path. A funnel over
	// crawler sessions measures crawl order, not conversion.
	const rows = await db
		.select({
			path: events.path,
			count: sql<number>`count(distinct ${events.sessionId})`,
		})
		.from(events)
		.innerJoin(sessions, eq(events.sessionId, sessions.id))
		.where(
			and(
				inArray(events.path, paths),
				eq(events.eventType, 'pageview'),
				gte(events.timestamp, cutoff),
				isNotNull(sessions.humanConfirmedAt),
				isNull(events.debugOwnerId),
				isNull(sessions.debugOwnerId),
			),
		)
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

/**
 * Top page-to-page transitions, computed in Postgres with a window function.
 *
 * A ranked table rather than a Sankey, deliberately: aggregate path diagrams
 * merge visitors with opposite experiences into one indistinguishable ribbon, so
 * they look explanatory without being able to answer "who, and why". The table
 * says the same thing without implying more than the data supports.
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
			FROM analytics.events e
			WHERE event_type = 'pageview' AND timestamp >= ${cutoff} AND debug_owner_id IS NULL
			  -- Confirmed sessions only: a crawler's fetch order is not a navigation.
			  AND EXISTS (
					SELECT 1 FROM analytics.sessions s
					WHERE s.id = e.session_id AND s.human_confirmed_at IS NOT NULL AND s.debug_owner_id IS NULL
				)
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
		.where(and(gte(sessions.startedAt, cutoff), isNotNull(sessions.humanConfirmedAt), isNull(sessions.debugOwnerId)))
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
		.where(and(gte(sessions.startedAt, cutoff), isNotNull(sessions.humanConfirmedAt), isNull(sessions.debugOwnerId)))
		.groupBy(sql`coalesce(${sessions.exitPath}, ${sessions.entryPath})`)
		.orderBy(desc(sql`count(*)`))
		.limit(limit);
}

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
			  AND debug_owner_id IS NULL
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
		  AND debug_owner_id IS NULL
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

// Data age stats (for privacy page)

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
