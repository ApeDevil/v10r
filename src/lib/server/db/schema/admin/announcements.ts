/**
 * ANNOUNCEMENTS — System-wide broadcast messages with per-user dismissal.
 * Admins create announcements; all authenticated users see them as banners.
 * Critical severity announcements cannot be dismissed, only acknowledged.
 */

import { boolean, index, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from '../auth/_better-auth';
import { adminSchema } from './audit-log';

export const announcementSeverityEnum = adminSchema.enum('announcement_severity', [
	'info',
	'warning',
	'critical',
]);

export const announcements = adminSchema.table(
	'announcements',
	{
		/** Prefixed ID, e.g. 'ann_abc123' */
		id: text('id').primaryKey(),

		title: text('title').notNull(),
		body: text('body').notNull(),

		severity: announcementSeverityEnum('severity').notNull(),

		/** Manual kill switch — admin can deactivate without changing dates */
		active: boolean('active').notNull().default(true),

		/** NULL = active immediately */
		startsAt: timestamp('starts_at', { withTimezone: true }),

		/** NULL = active until deactivated */
		endsAt: timestamp('ends_at', { withTimezone: true }),

		/** Admin who created this (no FK — survives user deletion) */
		createdBy: text('created_by').notNull(),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('announcements_active_idx')
			.on(table.startsAt, table.endsAt)
			.where(sql`${table.active} = true`),
		index('announcements_created_desc_idx')
			.on(table.createdAt.desc())
			.where(sql`${table.active} = true`),
	],
);

export const announcementDismissals = adminSchema.table(
	'announcement_dismissals',
	{
		announcementId: text('announcement_id')
			.notNull()
			.references(() => announcements.id, { onDelete: 'cascade' }),

		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),

		/** Always set — records when the user saw and interacted with the announcement */
		acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }).notNull().defaultNow(),

		/** NULL for critical severity (acknowledged but not dismissed — banner stays) */
		dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
	},
	(table) => [
		primaryKey({ columns: [table.announcementId, table.userId] }),
		index('dismissals_user_idx').on(table.userId),
	],
);
