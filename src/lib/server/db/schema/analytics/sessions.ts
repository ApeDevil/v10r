/**
 * ANALYTICS SESSIONS — Visitor session records.
 * Device and country are consent-gated (only populated at 'analytics' or 'full' tier).
 */
import { text, integer, timestamp, char, index } from 'drizzle-orm/pg-core';
import { analyticsSchema, consentTierEnum } from './events';

export const sessions = analyticsSchema.table(
	'sessions',
	{
		id: text('id').primaryKey(),
		visitorId: text('visitor_id').notNull(),
		startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
		endedAt: timestamp('ended_at', { withTimezone: true }),
		pageCount: integer('page_count').notNull().default(0),
		entryPath: text('entry_path').notNull(),
		exitPath: text('exit_path'),
		device: text('device'),
		browser: text('browser'),
		country: char('country', { length: 2 }),
		consentTier: consentTierEnum('consent_tier').notNull().default('necessary'),
	},
	(table) => [
		index('sessions_visitor_idx').on(table.visitorId),
		index('sessions_started_desc_idx').on(table.startedAt.desc()),
	],
);
