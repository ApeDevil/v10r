/**
 * NOTIFICATIONS — In-app notification records.
 *
 * Locale-neutral payload pattern:
 *   - `messageKey` names a Paraglide message (e.g. 'notif_feedback_received').
 *   - `messageParams` carries ICU interpolation values (e.g. {name: 'Anna'}).
 *   - The viewer (in-app list) and the delivery worker (email/push) render via
 *     Paraglide using the *recipient's* preferred locale, NOT the locale of
 *     the request that created the notification.
 */

import { sql } from 'drizzle-orm';
import { boolean, index, jsonb, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';
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

/** ICU interpolation values for a notification message. Keep flat and JSON-safe. */
export type NotificationParams = Record<string, string | number>;

export const notifications = notificationsSchema.table(
	'notifications',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
		type: notificationTypeEnum('type').notNull(),
		messageKey: text('message_key').notNull(),
		messageParams: jsonb('message_params').$type<NotificationParams>().notNull().default(sql`'{}'::jsonb`),
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
		index('notification_user_unread_idx').on(table.userId, table.createdAt.desc()).where(sql`is_read = false`),
	],
);
