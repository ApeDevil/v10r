/**
 * NOTIFICATIONS — In-app notification records.
 * Each notification is scoped to a user and optionally references an actor.
 */
import { pgSchema, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from '../auth/_better-auth';

export const notificationsSchema = pgSchema('notifications');

export const notificationTypeEnum = notificationsSchema.enum('notification_type', [
	'mention',
	'comment',
	'system',
	'success',
	'security',
	'follow',
]);

export const notifications = notificationsSchema.table(
	'notifications',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
		type: notificationTypeEnum('type').notNull(),
		title: text('title').notNull(),
		body: text('body'),
		entityRef: text('entity_ref'),
		groupKey: text('group_key'),
		actionUrl: text('action_url'),
		isRead: boolean('is_read').notNull().default(false),
		readAt: timestamp('read_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		archivedAt: timestamp('archived_at', { withTimezone: true }),
	},
	(table) => [
		index('notification_user_created_idx').on(table.userId, table.createdAt.desc()),
		index('notification_user_unread_idx')
			.on(table.userId, table.createdAt.desc())
			.where(sql`is_read = false`),
	],
);
