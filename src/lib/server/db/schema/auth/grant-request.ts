/**
 * AUTH GRANT REQUEST — Self-service queue for capability grants.
 * Partial UNIQUE (user_id, kind) WHERE status='pending' enforces one open
 * request per user per kind. Approved/denied rows stay for audit.
 *
 * Auto-expiry: a cron job soft-denies pending rows older than 14 days
 * with resolvedBy = NULL as the system sentinel.
 */
import { sql } from 'drizzle-orm';
import { index, pgEnum, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { authSchema, user } from './_better-auth';
import { grantKindEnum } from './grant';

export const grantRequestStatusEnum = pgEnum('grant_request_status', ['pending', 'approved', 'denied']);

export const grantRequest = authSchema.table(
	'grant_request',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		kind: grantKindEnum('kind').notNull(),
		status: grantRequestStatusEnum('status').notNull().default('pending'),
		message: text('message'),
		requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
		resolvedAt: timestamp('resolved_at', { withTimezone: true }),
		resolvedBy: text('resolved_by').references(() => user.id, { onDelete: 'set null' }),
	},
	(table) => [
		uniqueIndex('auth_grant_request_pending_uniq').on(table.userId, table.kind).where(sql`status = 'pending'`),
		index('auth_grant_request_queue_idx').on(table.requestedAt).where(sql`status = 'pending'`),
		index('auth_grant_request_user_idx').on(table.userId),
	],
);
