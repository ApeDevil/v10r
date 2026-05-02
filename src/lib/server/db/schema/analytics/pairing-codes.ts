/**
 * ANALYTICS PAIRING CODES — Short-lived debug-pairing tokens.
 * Admin generates a 6-digit code on PC; phone consumes it via /pair/[code]
 * to attach the admin's identity to the phone's anonymous session.
 */
import { sql } from 'drizzle-orm';
import { check, index, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
import { analyticsSchema } from './events';
import { sessions } from './sessions';

export const pairingCodes = analyticsSchema.table(
	'pairing_codes',
	{
		/** 6 digits in the [2-9] alphabet. PK + lookup key. */
		code: text('code').primaryKey(),
		adminUserId: text('admin_user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		consumedAt: timestamp('consumed_at', { withTimezone: true }),
		consumedBySessionId: text('consumed_by_session_id').references(() => sessions.id, { onDelete: 'set null' }),
		attemptCount: integer('attempt_count').notNull().default(0),
	},
	(table) => [
		check('pairing_code_format', sql`${table.code} ~ '^[2-9]{6}$'`),
		check('pairing_attempt_cap', sql`${table.attemptCount} <= 5`),
		index('pairing_codes_expires_idx').on(table.expiresAt).where(sql`${table.consumedAt} IS NULL`),
		index('pairing_codes_admin_idx').on(table.adminUserId, table.createdAt),
	],
);
