import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { user } from '$lib/server/db/schema/auth/_better-auth';
import { notificationDeliveries } from '$lib/server/db/schema/notifications/deliveries';
import { notifications } from '$lib/server/db/schema/notifications/notifications';
import { makeNotification, makeUser } from '$lib/server/test/fixtures';

let testClient: PGlite;

vi.mock('$lib/server/db', async () => {
	const { createTestDb } = await import('$lib/server/test/db');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

const { createDeliveries, getPendingDeliveries, markProcessing, markSent, markFailed } = await import('./outbox');
const { db } = await import('$lib/server/db');

const USER_A = makeUser({ id: 'user-outbox' });

describe('notification outbox', () => {
	let notificationId: string;

	beforeAll(async () => {
		await db.insert(user).values(USER_A);
	});

	afterAll(async () => {
		await testClient?.close();
	});

	beforeEach(async () => {
		await db.delete(notificationDeliveries);
		await db.delete(notifications);

		// Seed a notification for FK references
		const n = makeNotification({ userId: USER_A.id });
		await db.insert(notifications).values(n);
		notificationId = n.id;
	});

	describe('createDeliveries', () => {
		it('creates records for each channel', async () => {
			const result = await createDeliveries(notificationId, ['email', 'telegram']);
			expect(result).toHaveLength(2);
			expect(result[0].channel).toBe('email');
			expect(result[1].channel).toBe('telegram');
			expect(result[0].status).toBe('pending');
		});

		it('returns empty array for empty channels', async () => {
			const result = await createDeliveries(notificationId, []);
			expect(result).toEqual([]);
		});
	});

	describe('getPendingDeliveries', () => {
		it('returns only pending deliveries ordered by createdAt', async () => {
			await createDeliveries(notificationId, ['email', 'discord']);

			// Mark first one as processing
			const all = await db.select().from(notificationDeliveries);
			await db
				.update(notificationDeliveries)
				.set({ status: 'processing' })
				.where(eq(notificationDeliveries.id, all[0].id));

			const pending = await getPendingDeliveries(10);
			expect(pending).toHaveLength(1);
			expect(pending[0].status).toBe('pending');
		});
	});

	describe('markProcessing', () => {
		it('transitions status and increments attempts', async () => {
			const [delivery] = await createDeliveries(notificationId, ['email']);
			await markProcessing(delivery.id);

			const [updated] = await db
				.select()
				.from(notificationDeliveries)
				.where(eq(notificationDeliveries.id, delivery.id));
			expect(updated.status).toBe('processing');
			expect(updated.attempts).toBe(1);
			expect(updated.attemptedAt).toBeTruthy();
		});
	});

	describe('markSent', () => {
		it('transitions status and sets sentAt', async () => {
			const [delivery] = await createDeliveries(notificationId, ['email']);
			await markSent(delivery.id, 'provider-123');

			const [updated] = await db
				.select()
				.from(notificationDeliveries)
				.where(eq(notificationDeliveries.id, delivery.id));
			expect(updated.status).toBe('sent');
			expect(updated.sentAt).toBeTruthy();
			expect(updated.providerMessageId).toBe('provider-123');
		});
	});

	describe('markFailed', () => {
		it('requeues if retryable and under max attempts', async () => {
			const [delivery] = await createDeliveries(notificationId, ['email']);
			// attempts is 0, DELIVERY_MAX_ATTEMPTS is 3
			await markFailed(delivery.id, 'SMTP_ERR', 'Connection refused', true);

			const [updated] = await db
				.select()
				.from(notificationDeliveries)
				.where(eq(notificationDeliveries.id, delivery.id));
			expect(updated.status).toBe('pending'); // requeued
			expect(updated.errorCode).toBe('SMTP_ERR');
		});

		it('permanent failure when exceeds max attempts', async () => {
			const [delivery] = await createDeliveries(notificationId, ['email']);

			// Simulate 3 attempts already
			await db.update(notificationDeliveries).set({ attempts: 3 }).where(eq(notificationDeliveries.id, delivery.id));

			await markFailed(delivery.id, 'SMTP_ERR', 'Connection refused', true);

			const [updated] = await db
				.select()
				.from(notificationDeliveries)
				.where(eq(notificationDeliveries.id, delivery.id));
			expect(updated.status).toBe('failed'); // permanent
		});

		it('permanent failure when not retryable', async () => {
			const [delivery] = await createDeliveries(notificationId, ['email']);
			await markFailed(delivery.id, 'INVALID', 'Bad address', false);

			const [updated] = await db
				.select()
				.from(notificationDeliveries)
				.where(eq(notificationDeliveries.id, delivery.id));
			expect(updated.status).toBe('failed');
		});
	});
});
