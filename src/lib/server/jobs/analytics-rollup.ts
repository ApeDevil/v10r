import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { rowCountOf } from '$lib/server/db/rows';

/**
 * Compute daily page stats from raw events for yesterday.
 * Idempotent via INSERT … ON CONFLICT, so it is safe to re-run.
 *
 * ## How the two derived metrics are defined, and why not the obvious way
 *
 * **Duration** is real engaged time — accumulated client-side from
 * `visibilitychange` so a hidden tab contributes nothing — carried on
 * `engagement` action events. NOT `(ended_at - started_at) / page_count`, which
 * counts a tab left open over lunch as deep engagement; that is precisely why
 * raw time-on-page is a vanity metric.
 *
 * **Bounce rate** is a single-page session that ALSO failed to clear an
 * engagement threshold — someone who arrived, did not stay, and left. NOT
 * `page_count = 1`: the SPA beacon does not advance `page_count`, so that would
 * make almost every visitor look single-page, and a "bounce" that lasted four
 * minutes of reading is not a bounce in any useful sense.
 *
 * Sessions with no engagement event at all (client JS blocked, or consent below
 * the analytics tier) count as bounces only when they are also single-page. They
 * cannot be told apart from a genuine quick exit, and assuming engagement would
 * flatter the number.
 */

/** Seconds of engaged time a single-page session needs in order not to be a bounce. */
const ENGAGED_BOUNCE_THRESHOLD_SEC = 10;

/**
 * Compute the rollup for ONE day. Defaults to yesterday, which is what the cron
 * entry wants; pass a `YYYY-MM-DD` string to recompute any other day.
 *
 * The parameter exists because cron delivery is best-effort — Vercel documents
 * that a scheduled run can be skipped entirely — and this job only ever computes
 * a single day, so a skipped run leaves a permanent hole that the next run does
 * NOT fill. Without a way to name the day, repairing that hole meant editing the
 * job. `ON CONFLICT DO UPDATE` already makes it idempotent, so re-running a day
 * that exists simply recomputes it.
 */
export async function analyticsRollup(day?: string): Promise<number> {
	let dateStr: string;
	if (day === undefined) {
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		dateStr = yesterday.toISOString().slice(0, 10);
	} else {
		// Shape-checked up front. Drizzle binds this as a parameter rather than
		// splicing it, so the concern is not injection — it is that a malformed value
		// reaches Postgres as a failed ::date cast deep inside a CTE, where the error
		// names neither this job nor the argument that caused it.
		if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`analyticsRollup: invalid day '${day}'`);
		dateStr = day;
	}

	const result = await db.execute(sql`
		WITH day_events AS (
			SELECT *
			FROM analytics.events
			WHERE timestamp >= ${dateStr}::date
			  AND timestamp < (${dateStr}::date + interval '1 day')
			  -- The operator's own tagged traffic never reaches the rollup. The
			  -- event-side tag is immutable, unlike the session-side pairing column
			  -- the cleanup reaper clears after 2h.
			  AND debug_owner_id IS NULL
		),
		-- Engaged seconds per (session, path), from the client's visibility-aware clock.
		engagement AS (
			SELECT
				session_id,
				path,
				sum((metadata->>'seconds')::numeric) AS engaged_sec
			FROM day_events
			WHERE event_type = 'action'
			  AND metadata->>'event' = 'engagement'
			  AND metadata->>'seconds' ~ '^[0-9]+$'
			GROUP BY session_id, path
		),
		pageviews AS (
			SELECT
				d.session_id,
				d.visitor_id,
				d.path,
				s.human_confirmed_at IS NOT NULL AS confirmed,
				s.page_count
			FROM day_events d
			JOIN analytics.sessions s ON s.id = d.session_id
			WHERE d.event_type = 'pageview'
			  AND s.debug_owner_id IS NULL
		)
		-- unique_visitors / pageviews / duration / bounce are CONFIRMED-only (the
		-- headline lane); unconfirmed_pageviews carries the rest. A path with only
		-- unconfirmed traffic still gets a row — "which pages attract crawlers" is
		-- itself a signal. See the schema doc in aggregates.ts.
		INSERT INTO analytics.daily_page_stats
			(date, path, unique_visitors, pageviews, unconfirmed_pageviews, avg_duration_ms, bounce_rate)
		SELECT
			${dateStr} AS date,
			p.path,
			COUNT(DISTINCT p.visitor_id) FILTER (WHERE p.confirmed) AS unique_visitors,
			COUNT(*) FILTER (WHERE p.confirmed) AS pageviews,
			COUNT(*) FILTER (WHERE NOT p.confirmed) AS unconfirmed_pageviews,
			-- Engaged milliseconds, averaged over the sessions that reported any.
			-- Confirmed-only by construction: engagement events imply client JS.
			COALESCE(AVG(e.engaged_sec) FILTER (WHERE p.confirmed) * 1000, 0)::integer AS avg_duration_ms,
			CASE
				WHEN COUNT(DISTINCT p.session_id) FILTER (WHERE p.confirmed) = 0 THEN 0
				ELSE (
					COUNT(DISTINCT p.session_id) FILTER (
						WHERE p.confirmed
						  AND p.page_count = 1
						  AND COALESCE(e.engaged_sec, 0) < ${ENGAGED_BOUNCE_THRESHOLD_SEC}
					) * 100 / COUNT(DISTINCT p.session_id) FILTER (WHERE p.confirmed)
				)
			END AS bounce_rate
		FROM pageviews p
		LEFT JOIN engagement e ON e.session_id = p.session_id AND e.path = p.path
		GROUP BY p.path
		ON CONFLICT (date, path) DO UPDATE SET
			unique_visitors = EXCLUDED.unique_visitors,
			pageviews = EXCLUDED.pageviews,
			unconfirmed_pageviews = EXCLUDED.unconfirmed_pageviews,
			avg_duration_ms = EXCLUDED.avg_duration_ms,
			bounce_rate = EXCLUDED.bounce_rate
		RETURNING 1
	`);

	// RETURNING + rowCountOf, not a raw `.rowCount` read: that property exists
	// only on the pg QueryResult shape and is undefined on pglite, so the old
	// form silently reported 0 under test. See $lib/server/db/rows.
	return rowCountOf(result);
}
