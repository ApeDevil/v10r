import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeNotification, makeUser } from '$lib/server/test/fixtures';
import { user } from '../schema/auth/_better-auth';
import { notificationSettings } from '../schema/notifications/notification-settings';
import { notifications } from '../schema/notifications/notifications';

let testClient: PGlite;

vi.mock('$lib/server/db', async () => {
	const { createTestDb } = await import('$lib/server/test/db');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

const { createNotification, markAsRead, markAllAsRead, getOrCreateSettings } = await import('./mutations');
const { db } = await import('$lib/server/db');

const USER_A = makeUser({ id: 'user-a' });
const USER_B = makeUser({ id: 'user-b' });

describe('notification mutations', () => {
	beforeAll(async () => {
		await db.insert(user).values([USER_A, USER_B]);
	});

	afterAll(async () => {
		await testClient?.close();
	});

	beforeEach(async () => {
		await db.delete(notificationSettings);
		await db.delete(notifications);
	});

	describe('createNotification', () => {
		it('creates a notification with all fields', async () => {
			const result = await createNotification({
				userId: USER_A.id,
				type: 'mention',
				messageKey: 'notif_mention',
				messageParams: { name: 'Alice' },
				actionUrl: '/post/123',
			});

			expect(result).toBeDefined();
			expect(result?.userId).toBe(USER_A.id);
			expect(result?.type).toBe('mention');
			expect(result?.messageKey).toBe('notif_mention');
			expect(result?.messageParams).toEqual({ name: 'Alice' });
			expect(result?.isRead).toBe(false);
			expect(result?.id).toBeTruthy();
		});

		it('creates a notification with minimal fields', async () => {
			const result = await createNotification({
				userId: USER_A.id,
				type: 'system',
				messageKey: 'notif_system',
			});

			expect(result).toBeDefined();
			expect(result?.messageParams).toEqual({});
			expect(result?.actionUrl).toBeNull();
		});
	});

	describe('markAsRead', () => {
		it('marks a notification as read for the correct user', async () => {
			const n = makeNotification({ userId: USER_A.id });
			await db.insert(notifications).values(n);

			const result = await markAsRead(n.id, USER_A.id);
			expect(result).toBe(true);
		});

		it('returns false for wrong user (IDOR protection)', async () => {
			const n = makeNotification({ userId: USER_A.id });
			await db.insert(notifications).values(n);

			const result = await markAsRead(n.id, USER_B.id);
			expect(result).toBe(false);
		});

		it('returns false for nonexistent ID', async () => {
			const result = await markAsRead('nonexistent', USER_A.id);
			expect(result).toBe(false);
		});
	});

	describe('markAllAsRead', () => {
		it('marks all unread notifications as read', async () => {
			await db
				.insert(notifications)
				.values([
					makeNotification({ userId: USER_A.id, isRead: false }),
					makeNotification({ userId: USER_A.id, isRead: false }),
					makeNotification({ userId: USER_A.id, isRead: true }),
				]);

			const count = await markAllAsRead(USER_A.id);
			expect(count).toBe(2);
		});

		it('returns 0 when no unread', async () => {
			const count = await markAllAsRead(USER_A.id);
			expect(count).toBe(0);
		});

		it('does not affect other users', async () => {
			await db
				.insert(notifications)
				.values([
					makeNotification({ userId: USER_A.id, isRead: false }),
					makeNotification({ userId: USER_B.id, isRead: false }),
				]);

			const count = await markAllAsRead(USER_A.id);
			expect(count).toBe(1);
		});
	});

	describe('getOrCreateSettings', () => {
		it('creates default settings for a new user', async () => {
			const settings = await getOrCreateSettings(USER_A.id);

			expect(settings).toBeDefined();
			expect(settings?.userId).toBe(USER_A.id);
			expect(settings?.emailMention).toBe(true);
			expect(settings?.digestFrequency).toBe('instant');
		});

		it('returns existing settings on second call (idempotent)', async () => {
			const first = await getOrCreateSettings(USER_A.id);
			const second = await getOrCreateSettings(USER_A.id);

			expect(first?.userId).toBe(second?.userId);
			expect(first?.updatedAt.getTime()).toBe(second?.updatedAt.getTime());
		});
	});
});
