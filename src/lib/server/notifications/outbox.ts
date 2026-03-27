/**
 * Notification outbox — manages delivery records in the outbox table.
 */
import { eq, sql } from 'drizzle-orm';
import { DELIVERY_MAX_ATTEMPTS } from '$lib/server/config';
import { db } from '$lib/server/db';
import { notificationDeliveries } from '$lib/server/db/schema/notifications/deliveries';

type Channel = 'email' | 'telegram' | 'discord';

/** Create delivery records for a notification's target channels */
export async function createDeliveries(notificationId: string, channels: Channel[]) {
	if (channels.length === 0) return [];

	return db
		.insert(notificationDeliveries)
		.values(
			channels.map((channel) => ({
				id: crypto.randomUUID(),
				notificationId,
				channel,
			})),
		)
		.returning();
}

/** Get a batch of pending deliveries */
export async function getPendingDeliveries(batchSize: number) {
	return db
		.select()
		.from(notificationDeliveries)
		.where(eq(notificationDeliveries.status, 'pending'))
		.orderBy(notificationDeliveries.createdAt)
		.limit(batchSize);
}

/** Mark a delivery as processing */
export async function markProcessing(id: string) {
	await db
		.update(notificationDeliveries)
		.set({
			status: 'processing',
			attemptedAt: new Date(),
			attempts: sql`${notificationDeliveries.attempts} + 1`,
		})
		.where(eq(notificationDeliveries.id, id));
}

/** Mark a delivery as sent */
export async function markSent(id: string, providerMessageId?: string) {
	await db
		.update(notificationDeliveries)
		.set({
			status: 'sent',
			providerMessageId: providerMessageId ?? null,
			sentAt: new Date(),
		})
		.where(eq(notificationDeliveries.id, id));
}

/** Mark a delivery as failed — retries if under max attempts, else permanent failure */
export async function markFailed(id: string, errorCode: string, errorMessage: string, retryable: boolean) {
	// Check current attempts
	const [delivery] = await db
		.select({ attempts: notificationDeliveries.attempts })
		.from(notificationDeliveries)
		.where(eq(notificationDeliveries.id, id))
		.limit(1);

	const requeue = retryable && delivery && delivery.attempts < DELIVERY_MAX_ATTEMPTS;

	await db
		.update(notificationDeliveries)
		.set({
			status: requeue ? 'pending' : 'failed',
			errorCode,
			errorMessage,
		})
		.where(eq(notificationDeliveries.id, id));
}
