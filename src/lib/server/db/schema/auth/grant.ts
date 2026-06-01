/**
 * AUTH GRANT — Admin-granted, revocable capabilities.
 * One row per (userId, kind); active when revoked_at IS NULL.
 * v1 supports kind='blog-author'; add new kinds by extending grantKindEnum.
 *
 * Notification: notifiedAt holds the timestamp of the first /desk visit
 * after grant — set by the layout load, cleared via single-fire UPDATE.
 */
import { sql } from 'drizzle-orm';
import { index, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { authSchema, user } from './_better-auth';

export const grantKindEnum = authSchema.enum('grant_kind', ['blog-author']);

export const grant = authSchema.table(
	'grant',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		kind: grantKindEnum('kind').notNull(),
		grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
		grantedBy: text('granted_by')
			.notNull()
			.references(() => user.id, { onDelete: 'restrict' }),
		revokedAt: timestamp('revoked_at', { withTimezone: true }),
		revokedBy: text('revoked_by').references(() => user.id, { onDelete: 'set null' }),
		notifiedAt: timestamp('notified_at', { withTimezone: true }),
	},
	(table) => [
		uniqueIndex('auth_grant_active_uniq').on(table.userId, table.kind).where(sql`revoked_at IS NULL`),
		index('auth_grant_kind_active_idx').on(table.kind).where(sql`revoked_at IS NULL`),
		index('auth_grant_user_idx').on(table.userId),
	],
);
