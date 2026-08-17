/**
 * Performance-observatory queries — real-user telemetry, read with the dev lane
 * separated out rather than silently mixed in.
 *
 * Every query here reports the size of what it excluded. That is not decoration:
 * an aggregate that quietly drops rows is indistinguishable from one with no rows
 * to drop, and the difference between those two is exactly the bug that made the
 * previous vitals page understate TTFB by 36%.
 */

import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { DEV_SCOPE_PATTERN, PROD_SCOPE_MARKER, type TelemetryLane } from '$lib/server/db/analytics/lanes';
import { rowsOf } from '$lib/server/db/rows';

/** Numeric-value guard — `metadata->>'value'` is untyped JSON text. */
const NUMERIC = '^[0-9]+(\\.[0-9]+)?$';

/**
 * Per-session lane verdict, derived from Svelte scope classes in the attribution
 * targets. Mirrors `classifyLane()` exactly, including dev-wins-over-prod; the
 * shared pattern constants are what keep the two implementations honest.
 */
function lanesCte(cutoff: Date) {
	return sql`
		lanes AS (
			SELECT session_id,
			       bool_or(metadata->>'target' ~ ${DEV_SCOPE_PATTERN}) AS has_dev,
			       bool_or(position(${PROD_SCOPE_MARKER} in metadata->>'target') > 0) AS has_prod
			FROM analytics.events
			WHERE event_type = 'timing'
			  AND metadata->>'target' IS NOT NULL
			  AND timestamp >= ${cutoff}
			GROUP BY session_id
		)`;
}

const LANE_EXPR = sql`
	CASE WHEN COALESCE(l.has_dev, false) THEN 'dev'
	     WHEN COALESCE(l.has_prod, false) THEN 'prod'
	     ELSE 'unknown' END`;

function cutoffFor(days: number): Date {
	return new Date(Date.now() - days * 86400000);
}

export interface VitalLaneSummary {
	metric: string;
	/** p75 over the PROD lane only. Null when the prod lane has no samples. */
	p75: number | null;
	/** Prod-lane sample count — the denominator behind `p75`. */
	samples: number;
	/** Excluded as dev-server traffic. Non-zero here means the source gate regressed. */
	devSamples: number;
	/** Carried no scope class, so unclassifiable. Excluded, not assumed prod. */
	unknownSamples: number;
	/** Element most often blamed, prod lane only. */
	worstTarget: string | null;
}

/**
 * Web Vitals at p75, split by lane.
 *
 * p75 rather than the mean because that is how Google scores Core Web Vitals, and
 * because a mean hides the long tail users actually notice. `worstTarget` comes
 * from the attribution build and is what turns "INP is 400ms" into "this button
 * is 400ms" — the difference between a number and something actionable.
 */
export async function getVitalsByLane(days: number): Promise<VitalLaneSummary[]> {
	const cutoff = cutoffFor(days);

	const rows = await db.execute(sql`
		WITH ${lanesCte(cutoff)},
		samples AS (
			SELECT e.metadata->>'metric' AS metric,
			       (e.metadata->>'value')::numeric AS value,
			       e.metadata->>'target' AS target,
			       ${LANE_EXPR} AS lane
			FROM analytics.events e
			LEFT JOIN lanes l ON l.session_id = e.session_id
			WHERE e.event_type = 'timing'
			  AND e.timestamp >= ${cutoff}
			  AND e.debug_owner_id IS NULL
			  AND e.metadata->>'metric' IS NOT NULL
			  AND e.metadata->>'value' ~ ${NUMERIC}
		),
		blame AS (
			SELECT DISTINCT ON (metric) metric, target
			FROM samples
			WHERE lane = 'prod' AND target IS NOT NULL
			GROUP BY metric, target
			ORDER BY metric, count(*) DESC
		)
		SELECT
			s.metric,
			percentile_cont(0.75) WITHIN GROUP (ORDER BY s.value) FILTER (WHERE s.lane = 'prod') AS p75,
			count(*) FILTER (WHERE s.lane = 'prod')::int AS samples,
			count(*) FILTER (WHERE s.lane = 'dev')::int AS dev_samples,
			count(*) FILTER (WHERE s.lane = 'unknown')::int AS unknown_samples,
			(SELECT b.target FROM blame b WHERE b.metric = s.metric) AS worst_target
		FROM samples s
		GROUP BY s.metric
		ORDER BY s.metric
	`);

	return rowsOf<{
		metric: string;
		p75: string | null;
		samples: number;
		dev_samples: number;
		unknown_samples: number;
		worst_target: string | null;
	}>(rows).map((r) => ({
		metric: r.metric,
		p75: r.p75 === null ? null : Math.round(Number(r.p75) * 1000) / 1000,
		samples: Number(r.samples),
		devSamples: Number(r.dev_samples),
		unknownSamples: Number(r.unknown_samples),
		worstTarget: r.worst_target,
	}));
}

export interface VitalTrendPoint {
	date: string;
	metric: string;
	p75: number;
	samples: number;
}

/**
 * Daily p75 per metric, prod lane only — a single number cannot show a
 * regression, and a regression you cannot see is one you ship.
 *
 * Days with no prod samples are absent rather than zero-filled: a zero would
 * render as a dramatic improvement.
 */
export async function getVitalsTrend(days: number): Promise<VitalTrendPoint[]> {
	const cutoff = cutoffFor(days);

	const rows = await db.execute(sql`
		WITH ${lanesCte(cutoff)}
		SELECT
			to_char(date_trunc('day', e.timestamp), 'YYYY-MM-DD') AS date,
			e.metadata->>'metric' AS metric,
			percentile_cont(0.75) WITHIN GROUP (ORDER BY (e.metadata->>'value')::numeric) AS p75,
			count(*)::int AS samples
		FROM analytics.events e
		LEFT JOIN lanes l ON l.session_id = e.session_id
		WHERE e.event_type = 'timing'
		  AND e.timestamp >= ${cutoff}
		  AND e.debug_owner_id IS NULL
		  AND e.metadata->>'metric' IS NOT NULL
		  AND e.metadata->>'value' ~ ${NUMERIC}
		  AND COALESCE(l.has_prod, false) AND NOT COALESCE(l.has_dev, false)
		GROUP BY 1, 2
		ORDER BY 1, 2
	`);

	return rowsOf<{ date: string; metric: string; p75: string; samples: number }>(rows).map((r) => ({
		date: r.date,
		metric: r.metric,
		p75: Math.round(Number(r.p75) * 1000) / 1000,
		samples: Number(r.samples),
	}));
}

// Idle-gap profile

export const IDLE_GAP_BUCKETS = ['lt1m', '1to15m', '15to60m', 'gt60m'] as const;
export type IdleGapBucket = (typeof IDLE_GAP_BUCKETS)[number];

export interface IdleGapRow {
	bucket: IdleGapBucket;
	samples: number;
	p50: number | null;
	p75: number | null;
}

/**
 * TTFB grouped by how long the platform had been idle before the visit started.
 *
 * ## What the gap actually measures
 *
 * For each visit, the gap is the time between that session's `started_at` and the
 * most recent request from ANY OTHER session — including crawler hits, which are
 * ~50x human traffic here and are what actually keeps a serverless container
 * warm. Both halves of that definition are load-bearing and both were wrong in
 * the hand-rolled version of this query that preceded it:
 *
 *   - Anchoring on the timing event and using `lag()` over all events measured the
 *     gap to the SIBLING event of the same page load, milliseconds earlier. Every
 *     sample then landed in the "<1m" bucket and the panel showed one bar.
 *   - Excluding crawler hits from the stream overstates idle time enormously,
 *     because it is precisely the crawlers filling those gaps.
 *
 * ## What it does not measure
 *
 * This is a proxy, not an instrument. It cannot see which physical container
 * served a request, so a short gap does not prove a warm start — under a crawler
 * burst, requests fan out across many fresh containers, which produces short gaps
 * and slow responses at the same time. Read the shape, not the causality, and
 * read it only when `samples` is large enough to mean anything.
 */
export async function getIdleGapProfile(days: number): Promise<IdleGapRow[]> {
	const cutoff = cutoffFor(days);

	const rows = await db.execute(sql`
		WITH ${lanesCte(cutoff)},
		requests AS (
			SELECT timestamp AS ts, session_id FROM analytics.events WHERE timestamp >= ${cutoff}
			UNION ALL
			SELECT timestamp AS ts, NULL::text FROM analytics.bot_hits WHERE timestamp >= ${cutoff}
		),
		ttfb AS (
			SELECT e.session_id, s.started_at, (e.metadata->>'value')::numeric AS value
			FROM analytics.events e
			JOIN analytics.sessions s ON s.id = e.session_id
			LEFT JOIN lanes l ON l.session_id = e.session_id
			WHERE e.event_type = 'timing'
			  AND e.metadata->>'metric' = 'TTFB'
			  AND e.metadata->>'value' ~ ${NUMERIC}
			  AND e.timestamp >= ${cutoff}
			  AND e.debug_owner_id IS NULL
			  AND COALESCE(l.has_prod, false) AND NOT COALESCE(l.has_dev, false)
		),
		gapped AS (
			SELECT t.value, EXTRACT(EPOCH FROM (t.started_at - (
				SELECT max(r.ts) FROM requests r
				WHERE r.ts < t.started_at AND r.session_id IS DISTINCT FROM t.session_id
			))) AS gap_s
			FROM ttfb t
		)
		SELECT
			CASE WHEN gap_s < 60 THEN 'lt1m'
			     WHEN gap_s < 900 THEN '1to15m'
			     WHEN gap_s < 3600 THEN '15to60m'
			     ELSE 'gt60m' END AS bucket,
			count(*)::int AS samples,
			percentile_cont(0.5) WITHIN GROUP (ORDER BY value) AS p50,
			percentile_cont(0.75) WITHIN GROUP (ORDER BY value) AS p75
		FROM gapped
		WHERE gap_s IS NOT NULL
		GROUP BY 1
	`);

	const byBucket = new Map(
		rowsOf<{ bucket: IdleGapBucket; samples: number; p50: string | null; p75: string | null }>(rows).map((r) => [
			r.bucket,
			r,
		]),
	);

	// Emit every bucket in order, including empty ones — a missing bucket in a
	// monotonic-looking chart reads as a dip rather than as absent data.
	return IDLE_GAP_BUCKETS.map((bucket) => {
		const row = byBucket.get(bucket);
		return {
			bucket,
			samples: row ? Number(row.samples) : 0,
			p50: row?.p50 == null ? null : Math.round(Number(row.p50)),
			p75: row?.p75 == null ? null : Math.round(Number(row.p75)),
		};
	});
}

export interface RouteHotPath {
	route: string;
	/** Server-rendered pageviews — requests that actually cost render time. */
	renders: number;
	/** Crawler hits on the same route. */
	botHits: number;
}

/**
 * Server-rendered pageviews per route, beside crawler hits on the same route.
 *
 * Deliberately counts the SERVER-HOOK lane only, which is what `event_type =
 * 'pageview'` with a non-null route resolves to. Client-side SPA navigations
 * never reach the origin, so including them would inflate routes that are cheap
 * to serve and hide the ones paying for a full render. For a performance panel
 * the hook lane is the correct lane, not a limitation of it.
 *
 * The bot column is not a footnote. Crawlers run ~50x human volume here, so a
 * route's real render cost is dominated by them, and any capacity decision made
 * from the human column alone is made against 2% of the traffic.
 */
export async function getRouteHotPaths(days: number, limit = 15): Promise<RouteHotPath[]> {
	const cutoff = cutoffFor(days);

	const rows = await db.execute(sql`
		WITH human AS (
			SELECT route, count(*)::int AS renders
			FROM analytics.events
			WHERE event_type = 'pageview' AND route IS NOT NULL AND timestamp >= ${cutoff}
			GROUP BY route
		),
		bots AS (
			SELECT route, count(*)::int AS bot_hits
			FROM analytics.bot_hits
			WHERE route IS NOT NULL AND timestamp >= ${cutoff}
			GROUP BY route
		)
		SELECT
			COALESCE(h.route, b.route) AS route,
			COALESCE(h.renders, 0) AS renders,
			COALESCE(b.bot_hits, 0) AS bot_hits
		FROM human h
		FULL OUTER JOIN bots b ON b.route = h.route
		ORDER BY (COALESCE(h.renders, 0) + COALESCE(b.bot_hits, 0)) DESC
		LIMIT ${limit}
	`);

	return rowsOf<{ route: string; renders: number; bot_hits: number }>(rows).map((r) => ({
		route: r.route,
		renders: Number(r.renders),
		botHits: Number(r.bot_hits),
	}));
}

export interface LaneCensus {
	lane: TelemetryLane;
	samples: number;
	sessions: number;
}

/**
 * How the telemetry corpus splits across lanes.
 *
 * This is the observatory's self-check. Every other panel filters to the prod
 * lane; this one shows what that filter removed, so a source-side regression
 * (dev telemetry reaching production again) surfaces as a number going up rather
 * than as percentiles quietly drifting down.
 */
export async function getLaneCensus(days: number): Promise<LaneCensus[]> {
	const cutoff = cutoffFor(days);

	const rows = await db.execute(sql`
		WITH ${lanesCte(cutoff)}
		SELECT ${LANE_EXPR} AS lane,
		       count(*)::int AS samples,
		       count(DISTINCT e.session_id)::int AS sessions
		FROM analytics.events e
		LEFT JOIN lanes l ON l.session_id = e.session_id
		WHERE e.event_type = 'timing'
		  AND e.timestamp >= ${cutoff}
		  AND e.debug_owner_id IS NULL
		GROUP BY 1
		ORDER BY 2 DESC
	`);

	return rowsOf<{ lane: TelemetryLane; samples: number; sessions: number }>(rows).map((r) => ({
		lane: r.lane,
		samples: Number(r.samples),
		sessions: Number(r.sessions),
	}));
}
