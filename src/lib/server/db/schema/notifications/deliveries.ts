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
	'retrying',
	'dead',
]);

export const notificationChannelEnum = notificationsSchema.enum('notification_channel', [
	'email',
	'telegram',
	'discord',
	// Web push delivers synchronously (no outbox rows in v1 — the drain is
	// cron-dependent on serverless); the enum value exists for admin/health parity.
	'push',
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
		/**
		 * Earliest time this row may be claimed. `now()` on insert (immediately due);
		 * pushed forward by markFailed's exponential backoff and by the stale-claim
		 * reaper. This is the only thing that makes a retry a *delayed* retry.
		 *
		 * NOT NULL deliberately: a nullable column would force COALESCE into both the
		 * claim's WHERE and its ORDER BY, and — worse — btree ASC sorts NULLs LAST, so
		 * never-attempted rows would queue behind every retry.
		 */
		nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
		/**
		 * Claim timestamp AND lease start. Stamped by claimDeliveries(); never touched
		 * by markSent/markFailed. For any row sitting in 'processing' this therefore IS
		 * "when a worker took ownership" — which is why no separate claimed_at /
		 * lock_expires_at / worker_id column exists: the lease length is a constant
		 * (DELIVERY_CLAIM_LEASE_MS) and the fence token is `attempts`.
		 */
		attemptedAt: timestamp('attempted_at', { withTimezone: true }),
		sentAt: timestamp('sent_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		// Claim index — literally the claim's WHERE + ORDER BY. Ordered by due-time
		// rather than insert-time because a backed-off retry is not due when it was created.
		index('delivery_pending_idx').on(table.nextAttemptAt, table.createdAt).where(sql`status = 'pending'`),
		// Reaper index. The 'processing' set is bounded by batch size × live workers, so
		// this stays tiny — but without it the reaper seq-scans the table every 15s.
		index('delivery_processing_idx').on(table.attemptedAt).where(sql`status = 'processing'`),
		index('delivery_failed_idx').on(table.createdAt).where(sql`status = 'failed'`),
		index('delivery_notification_idx').on(table.notificationId),
		index('delivery_channel_recent_idx')
			.on(table.channel, table.createdAt.desc())
			.where(sql`status IN ('sent', 'failed', 'dead')`),
		index('delivery_dead_idx').on(table.channel, table.createdAt.desc()).where(sql`status = 'dead'`),
	],
);
