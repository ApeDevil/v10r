import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { rowCountOf } from '$lib/server/db/rows';

/**
 * Compute daily page stats from raw events for yesterday.
 * Idempotent via INSERT … ON CONFLICT, so it is safe to re-run.
 *
 * ## Both derived metrics were rewritten, because both were wrong
 *
 * **Duration** used to be `(session.ended_at - started_at) / page_count`:
 * wall-clock elapsed time divided by pages. That counts a tab left open over
 * lunch as deep engagement, which is exactly why raw time-on-page is treated as
 * a vanity metric. It now reads real engaged time — accumulated client-side from
 * `visibilitychange`, so a hidden tab contributes nothing — carried on
 * `engagement` action events.
 *
 * **Bounce rate** used to be `page_count = 1`. That was doubly broken: the SPA
 * beacon never advanced `page_count`, so almost every visitor looked like a
 * single-page session; and a "bounce" that lasted four minutes of reading is not
 * a bounce in any useful sense. It is now a single-page session that ALSO failed
 * to clear an engagement threshold — someone who arrived, did not stay, and left.
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
			SELECT session_id, visitor_id, path
			FROM day_events
			WHERE event_type = 'pageview'
		)
		INSERT INTO analytics.daily_page_stats
			(date, path, unique_visitors, pageviews, avg_duration_ms, bounce_rate)
		SELECT
			${dateStr} AS date,
			p.path,
			COUNT(DISTINCT p.visitor_id) AS unique_visitors,
			COUNT(*) AS pageviews,
			-- Engaged milliseconds, averaged over the sessions that reported any.
			COALESCE(AVG(e.engaged_sec) * 1000, 0)::integer AS avg_duration_ms,
			CASE
				WHEN COUNT(DISTINCT p.session_id) = 0 THEN 0
				ELSE (
					COUNT(DISTINCT p.session_id) FILTER (
						WHERE s.page_count = 1
						  AND COALESCE(e.engaged_sec, 0) < ${ENGAGED_BOUNCE_THRESHOLD_SEC}
					) * 100 / COUNT(DISTINCT p.session_id)
				)
			END AS bounce_rate
		FROM pageviews p
		JOIN analytics.sessions s ON s.id = p.session_id
		LEFT JOIN engagement e ON e.session_id = p.session_id AND e.path = p.path
		GROUP BY p.path
		ON CONFLICT (date, path) DO UPDATE SET
			unique_visitors = EXCLUDED.unique_visitors,
			pageviews = EXCLUDED.pageviews,
			avg_duration_ms = EXCLUDED.avg_duration_ms,
			bounce_rate = EXCLUDED.bounce_rate
		RETURNING 1
	`);

	// RETURNING + rowCountOf, not a raw `.rowCount` read: that property exists
	// only on the pg QueryResult shape and is undefined on pglite, so the old
	// form silently reported 0 under test. See $lib/server/db/rows.
	return rowCountOf(result);
}
