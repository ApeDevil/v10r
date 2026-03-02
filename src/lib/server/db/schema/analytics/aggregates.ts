/**
 * ANALYTICS DAILY PAGE STATS — Pre-computed rollup table for fast dashboard queries.
 * One row per (date, path) combination, computed from raw events.
 */
import { text, integer, index, unique } from 'drizzle-orm/pg-core';
import { analyticsSchema } from './events';

export const dailyPageStats = analyticsSchema.table(
	'daily_page_stats',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		date: text('date').notNull(),
		path: text('path').notNull(),
		uniqueVisitors: integer('unique_visitors').notNull().default(0),
		pageviews: integer('pageviews').notNull().default(0),
		avgDurationMs: integer('avg_duration_ms'),
		bounceRate: integer('bounce_rate'),
	},
	(table) => [
		unique('daily_page_stats_date_path_uniq').on(table.date, table.path),
		index('daily_page_stats_date_idx').on(table.date),
	],
);
