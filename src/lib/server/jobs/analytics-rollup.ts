import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';

/**
 * Compute daily page stats from raw events for yesterday.
 * Uses INSERT ... ON CONFLICT to be idempotent (safe to re-run).
 */
export async function analyticsRollup(): Promise<number> {
	const yesterday = new Date();
	yesterday.setDate(yesterday.getDate() - 1);
	const dateStr = yesterday.toISOString().slice(0, 10);

	const result = await db.execute(sql`
		INSERT INTO analytics.daily_page_stats
			(date, path, unique_visitors, pageviews, avg_duration_ms, bounce_rate)
		SELECT
			${dateStr} AS date,
			e.path,
			COUNT(DISTINCT e.visitor_id) AS unique_visitors,
			COUNT(*) AS pageviews,
			COALESCE(
				AVG(
					CASE WHEN s.page_count > 1
						THEN EXTRACT(EPOCH FROM (s.ended_at - s.started_at))::integer * 1000 / s.page_count
						ELSE NULL
					END
				)::integer,
				0
			) AS avg_duration_ms,
			CASE
				WHEN COUNT(*) = 0 THEN 0
				ELSE (COUNT(*) FILTER (WHERE s.page_count = 1) * 100 / COUNT(*))
			END AS bounce_rate
		FROM analytics.events e
		JOIN analytics.sessions s ON s.id = e.session_id
		WHERE e.event_type = 'pageview'
			AND e.timestamp >= ${dateStr}::date
			AND e.timestamp < (${dateStr}::date + interval '1 day')
		GROUP BY e.path
		ON CONFLICT (date, path) DO UPDATE SET
			unique_visitors = EXCLUDED.unique_visitors,
			pageviews = EXCLUDED.pageviews,
			avg_duration_ms = EXCLUDED.avg_duration_ms,
			bounce_rate = EXCLUDED.bounce_rate
	`);

	return (result as { rowCount?: number })?.rowCount ?? 0;
}
