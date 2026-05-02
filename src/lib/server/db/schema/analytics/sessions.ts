/**
 * ANALYTICS SESSIONS — Visitor session records.
 * Device and country are consent-gated (only populated at 'analytics' or 'full' tier).
 */
import { sql } from 'drizzle-orm';
import { char, index, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
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
		/** Admin user id this session is paired to for debug streaming. NULL = anonymous. */
		pairedAdminUserId: text('paired_admin_user_id').references(() => user.id, { onDelete: 'set null' }),
		/** When pairing was claimed. Used for the 2h hard cap. */
		pairedAt: timestamp('paired_at', { withTimezone: true }),
	},
	(table) => [
		index('sessions_visitor_idx').on(table.visitorId),
		index('sessions_started_desc_idx').on(table.startedAt.desc()),
		index('sessions_paired_admin_idx')
			.on(table.pairedAdminUserId, table.endedAt.desc())
			.where(sql`${table.pairedAdminUserId} IS NOT NULL`),
	],
);
