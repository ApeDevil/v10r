import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { user } from '../schema/auth/_better-auth';
import { notifications } from '../schema/notifications/notifications';
import { makeUser, makeNotification } from '$lib/server/test/fixtures';

let testClient: PGlite;

vi.mock('$lib/server/db', async () => {
	const { createTestDb } = await import('$lib/server/test/db');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

const { getNotifications, getUnreadCount, getNotificationById } = await import('./queries');
const { db } = await import('$lib/server/db');

const USER_A = makeUser({ id: 'user-a' });
const USER_B = makeUser({ id: 'user-b' });

describe('notification queries', () => {
	beforeAll(async () => {
		await db.insert(user).values([USER_A, USER_B]);
	});

	afterAll(async () => {
		await testClient?.close();
	});

	beforeEach(async () => {
		await db.delete(notifications);
	});

	describe('getNotifications', () => {
		it('returns notifications for a user, most recent first', async () => {
			const older = makeNotification({
				userId: USER_A.id,
				title: 'Older',
				createdAt: new Date('2024-01-01'),
			});
			const newer = makeNotification({
				userId: USER_A.id,
				title: 'Newer',
				createdAt: new Date('2024-06-01'),
			});
			await db.insert(notifications).values([older, newer]);

			const result = await getNotifications(USER_A.id, 10, 0);
			expect(result).toHaveLength(2);
			expect(result[0].title).toBe('Newer');
			expect(result[1].title).toBe('Older');
		});

		it('excludes other users notifications', async () => {
			await db.insert(notifications).values([
				makeNotification({ userId: USER_A.id, title: 'A' }),
				makeNotification({ userId: USER_B.id, title: 'B' }),
			]);

			const result = await getNotifications(USER_A.id, 10, 0);
			expect(result).toHaveLength(1);
			expect(result[0].title).toBe('A');
		});

		it('excludes archived notifications', async () => {
			await db.insert(notifications).values([
				makeNotification({ userId: USER_A.id, title: 'Active' }),
				makeNotification({
					userId: USER_A.id,
					title: 'Archived',
					archivedAt: new Date(),
				}),
			]);

			const result = await getNotifications(USER_A.id, 10, 0);
			expect(result).toHaveLength(1);
			expect(result[0].title).toBe('Active');
		});

		it('respects limit and offset', async () => {
			const items = Array.from({ length: 5 }, (_, i) =>
				makeNotification({
					userId: USER_A.id,
					title: `N${i}`,
					createdAt: new Date(2024, 0, i + 1),
				}),
			);
			await db.insert(notifications).values(items);

			const page1 = await getNotifications(USER_A.id, 2, 0);
			expect(page1).toHaveLength(2);

			const page2 = await getNotifications(USER_A.id, 2, 2);
			expect(page2).toHaveLength(2);
			expect(page2[0].id).not.toBe(page1[0].id);
		});
	});

	describe('getUnreadCount', () => {
		it('counts only unread, non-archived notifications', async () => {
			await db.insert(notifications).values([
				makeNotification({ userId: USER_A.id, isRead: false }),
				makeNotification({ userId: USER_A.id, isRead: false }),
				makeNotification({ userId: USER_A.id, isRead: true }),
				makeNotification({ userId: USER_A.id, isRead: false, archivedAt: new Date() }),
			]);

			const count = await getUnreadCount(USER_A.id);
			expect(count).toBe(2);
		});

		it('returns 0 when no unread', async () => {
			const count = await getUnreadCount(USER_A.id);
			expect(count).toBe(0);
		});
	});

	describe('getNotificationById', () => {
		it('returns notification for the correct user', async () => {
			const n = makeNotification({ userId: USER_A.id, title: 'Mine' });
			await db.insert(notifications).values(n);

			const result = await getNotificationById(n.id, USER_A.id);
			expect(result).not.toBeNull();
			expect(result!.title).toBe('Mine');
		});

		it('returns null for wrong user (IDOR protection)', async () => {
			const n = makeNotification({ userId: USER_A.id, title: 'Secret' });
			await db.insert(notifications).values(n);

			const result = await getNotificationById(n.id, USER_B.id);
			expect(result).toBeNull();
		});

		it('returns null for nonexistent ID', async () => {
			const result = await getNotificationById('nonexistent', USER_A.id);
			expect(result).toBeNull();
		});
	});
});
