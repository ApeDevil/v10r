/**
 * NOTIFICATION DELIVERIES — Outbox for external delivery channels.
 * Tracks delivery status for email, telegram, discord.
 */

import { sql } from 'drizzle-orm';
import { index, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { notifications, notificationsSchema } from './notifications';

export const deliveryStatusEnum = notificationsSchema.enum('delivery_status', [
	'pending',
	'processing',
	'sent',
	'failed',
	'skipped',
]);

export const notificationChannelEnum = notificationsSchema.enum('notification_channel', [
	'email',
	'telegram',
	'discord',
]);

export const notificationDeliveries = notificationsSchema.table(
	'notification_deliveries',
	{
		id: text('id').primaryKey(),
		notificationId: text('notification_id')
			.notNull()
			.references(() => notifications.id, { onDelete: 'cascade' }),
		channel: notificationChannelEnum('channel').notNull(),
		status: deliveryStatusEnum('status').notNull().default('pending'),
		providerMessageId: text('provider_message_id'),
		errorCode: text('error_code'),
		errorMessage: text('error_message'),
		attempts: integer('attempts').notNull().default(0),
		attemptedAt: timestamp('attempted_at', { withTimezone: true }),
		sentAt: timestamp('sent_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('delivery_pending_idx').on(table.createdAt).where(sql`status = 'pending'`),
		index('delivery_failed_idx').on(table.createdAt).where(sql`status = 'failed'`),
		index('delivery_notification_idx').on(table.notificationId),
	],
);
