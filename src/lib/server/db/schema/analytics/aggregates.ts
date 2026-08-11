/**
 * ANALYTICS DAILY PAGE STATS — Pre-computed rollup table for fast dashboard queries.
 * One row per (date, path) combination, computed from raw events.
 *
 * `unique_visitors` / `pageviews` / `avg_duration_ms` / `bounce_rate` count
 * CONFIRMED sessions only (`sessions.human_confirmed_at IS NOT NULL`) — the
 * headline lane. `unconfirmed_pageviews` carries the rest as a separate column
 * rather than a bucket key on purpose: a bucket in the unique key would change
 * the (date, path) grain and every reader with it. A path with only unconfirmed
 * traffic still gets a row (zeros in the confirmed columns) — "which pages
 * attract crawlers" is itself a signal.
 */
import { date, index, integer, text, unique } from 'drizzle-orm/pg-core';
import { analyticsSchema } from './events';

export const dailyPageStats = analyticsSchema.table(
	'daily_page_stats',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		date: date('date', { mode: 'string' }).notNull(),
		path: text('path').notNull(),
		uniqueVisitors: integer('unique_visitors').notNull().default(0),
		pageviews: integer('pageviews').notNull().default(0),
		unconfirmedPageviews: integer('unconfirmed_pageviews').notNull().default(0),
		avgDurationMs: integer('avg_duration_ms'),
		bounceRate: integer('bounce_rate'),
	},
	(table) => [
		unique('daily_page_stats_date_path_uniq').on(table.date, table.path),
		index('daily_page_stats_date_idx').on(table.date),
	],
);
