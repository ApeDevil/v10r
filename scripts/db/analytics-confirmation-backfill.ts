/**
 * One-off backfill for the confirmation counting model (2026-08).
 *
 * Run AFTER `db:push` has added the new columns and the new code is deployed:
 *
 *   podman exec v10r bun run scripts/db/analytics-confirmation-backfill.ts
 *
 * Three passes, all idempotent:
 *   1. `sessions.human_confirmed_at` from historical beacon evidence — journey
 *      rows have `route IS NULL`, telemetry rows are non-pageview types; either
 *      proves the client ran JS. The earliest such event is the timestamp.
 *   2. `sessions.debug_owner_id` from the immutable event-side tag (no-op on a
 *      database where pairing never tagged an event, but correct to run).
 *   3. Recompute `daily_page_stats` for every day still inside the raw-event
 *      retention window, so historical rows carry the confirmed/unconfirmed
 *      split instead of pre-split totals. The INSERT below is a copy of the one
 *      in `src/lib/server/jobs/analytics-rollup.ts` — a one-off ops script may
 *      not import it (that module reads $env at import time); if the job's SQL
 *      changes, this script is already obsolete rather than wrong.
 */
import { neonConfig, Pool } from '@neondatabase/serverless';

neonConfig.poolQueryViaFetch = true;

const url = process.env.NEON_DATABASE_URL_PROD;
if (!url) {
	console.error('NEON_DATABASE_URL_PROD not set');
	process.exit(1);
}
const pool = new Pool({ connectionString: url });

const ENGAGED_BOUNCE_THRESHOLD_SEC = 10;

const confirmed = await pool.query(`
	UPDATE analytics.sessions s
	SET human_confirmed_at = fb.first_beacon
	FROM (
		SELECT session_id, min(timestamp) AS first_beacon
		FROM analytics.events
		WHERE route IS NULL OR event_type <> 'pageview'
		GROUP BY session_id
	) fb
	WHERE s.id = fb.session_id AND s.human_confirmed_at IS NULL
`);
console.log(`1. sessions confirmed from beacon evidence: ${confirmed.rowCount}`);

const debugTagged = await pool.query(`
	UPDATE analytics.sessions s
	SET debug_owner_id = e.debug_owner_id
	FROM (
		SELECT DISTINCT session_id, debug_owner_id
		FROM analytics.events
		WHERE debug_owner_id IS NOT NULL
	) e
	WHERE s.id = e.session_id AND s.debug_owner_id IS NULL
`);
console.log(`2. sessions debug-tagged from event evidence: ${debugTagged.rowCount}`);

const { rows: days } = await pool.query<{ day: string }>(`
	SELECT DISTINCT ((timestamp AT TIME ZONE 'UTC')::date)::text AS day
	FROM analytics.events
	WHERE event_type = 'pageview'
	ORDER BY 1
`);
for (const { day } of days) {
	await pool.query(
		`
		WITH day_events AS (
			SELECT * FROM analytics.events
			WHERE timestamp >= $1::date AND timestamp < ($1::date + interval '1 day')
			  AND debug_owner_id IS NULL
		),
		engagement AS (
			SELECT session_id, path, sum((metadata->>'seconds')::numeric) AS engaged_sec
			FROM day_events
			WHERE event_type = 'action' AND metadata->>'event' = 'engagement' AND metadata->>'seconds' ~ '^[0-9]+$'
			GROUP BY session_id, path
		),
		pageviews AS (
			SELECT d.session_id, d.visitor_id, d.path,
			       s.human_confirmed_at IS NOT NULL AS confirmed, s.page_count
			FROM day_events d
			JOIN analytics.sessions s ON s.id = d.session_id
			WHERE d.event_type = 'pageview' AND s.debug_owner_id IS NULL
		)
		INSERT INTO analytics.daily_page_stats
			(date, path, unique_visitors, pageviews, unconfirmed_pageviews, avg_duration_ms, bounce_rate)
		SELECT
			$1 AS date, p.path,
			COUNT(DISTINCT p.visitor_id) FILTER (WHERE p.confirmed),
			COUNT(*) FILTER (WHERE p.confirmed),
			COUNT(*) FILTER (WHERE NOT p.confirmed),
			COALESCE(AVG(e.engaged_sec) FILTER (WHERE p.confirmed) * 1000, 0)::integer,
			CASE
				WHEN COUNT(DISTINCT p.session_id) FILTER (WHERE p.confirmed) = 0 THEN 0
				ELSE (
					COUNT(DISTINCT p.session_id) FILTER (
						WHERE p.confirmed AND p.page_count = 1 AND COALESCE(e.engaged_sec, 0) < $2
					) * 100 / COUNT(DISTINCT p.session_id) FILTER (WHERE p.confirmed)
				)
			END
		FROM pageviews p
		LEFT JOIN engagement e ON e.session_id = p.session_id AND e.path = p.path
		GROUP BY p.path
		ON CONFLICT (date, path) DO UPDATE SET
			unique_visitors = EXCLUDED.unique_visitors,
			pageviews = EXCLUDED.pageviews,
			unconfirmed_pageviews = EXCLUDED.unconfirmed_pageviews,
			avg_duration_ms = EXCLUDED.avg_duration_ms,
			bounce_rate = EXCLUDED.bounce_rate
	`,
		[day, ENGAGED_BOUNCE_THRESHOLD_SEC],
	);
}
console.log(`3. daily_page_stats recomputed for ${days.length} day(s)`);

const { rows: sanity } = await pool.query(`
	SELECT
		count(*) FILTER (WHERE human_confirmed_at IS NOT NULL)::int AS confirmed_sessions,
		count(*) FILTER (WHERE human_confirmed_at IS NULL)::int AS unconfirmed_sessions,
		count(*) FILTER (WHERE ip_class IS NOT NULL)::int AS classified_sessions
	FROM analytics.sessions
`);
console.log('sanity:', sanity[0]);

await pool.end();
