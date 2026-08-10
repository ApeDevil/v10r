import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { userPreferences } from '$lib/server/db/schema/app/user-preferences';
import { user } from '$lib/server/db/schema/auth/_better-auth';
import { notificationDeliveries } from '$lib/server/db/schema/notifications/deliveries';
import { notificationSettings } from '$lib/server/db/schema/notifications/notification-settings';
import { notifications } from '$lib/server/db/schema/notifications/notifications';
import { makeUser } from '$lib/server/test/fixtures';

let testClient: PGlite;

vi.mock('$lib/server/db', async () => {
	const { createTestDb } = await import('$lib/server/test/db');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

const { runDigest } = await import('./digest');
const { db } = await import('$lib/server/db');

const USER = makeUser({ id: 'user-digest' });

const HOUR = 60 * 60 * 1000;

async function seedNotification(createdAt: Date, messageKey = 'notif_mention') {
	const id = crypto.randomUUID();
	await db.insert(notifications).values({ id, userId: USER.id, type: 'mention', messageKey, createdAt });
	return id;
}

async function setSettings(values: Record<string, unknown>) {
	await db
		.insert(notificationSettings)
		.values({ userId: USER.id, ...values } as never)
		.onConflictDoUpdate({ target: notificationSettings.userId, set: values as never });
}

async function deliveries() {
	return db.select().from(notificationDeliveries);
}

describe('notification digest', () => {
	beforeAll(async () => {
		await db.insert(user).values(USER);
		await db.insert(userPreferences).values({ userId: USER.id, locale: 'en' });
	});

	afterAll(async () => {
		await testClient?.close();
	});

	beforeEach(async () => {
		await db.delete(notificationDeliveries);
		await db.delete(notifications);
		await db.delete(notificationSettings);
	});

	it('enqueues one delivery per routed channel, carrying a pre-rendered body', async () => {
		await setSettings({ digestFrequency: 'daily', emailSystem: true, telegramSystem: true, lastDigestAt: null });
		await seedNotification(new Date(Date.now() - 2 * HOUR));
		await seedNotification(new Date(Date.now() - 1 * HOUR));

		const result = await runDigest('daily');
		expect(result).toMatchObject({ claimed: 1, sent: 1, empty: 0, failed: 0 });

		const rows = await deliveries();
		expect(rows.map((r) => r.channel).sort()).toEqual(['email', 'telegram']);
		// The body is rendered ONCE at digest time — the worker sends it verbatim.
		for (const r of rows) {
			expect(r.bodyOverride).toContain('•');
			expect(r.status).toBe('pending');
		}
	});

	it('the carrier notification is archived so it never shows in the inbox', async () => {
		await setSettings({ digestFrequency: 'daily', emailSystem: true, lastDigestAt: null });
		await seedNotification(new Date(Date.now() - HOUR));

		await runDigest('daily');

		const carriers = await db.select().from(notifications).where(eq(notifications.messageKey, 'notif_digest_subject'));
		expect(carriers).toHaveLength(1);
		expect(carriers[0]?.archivedAt).not.toBeNull();
	});

	it('is idempotent — a second run in the same window claims nobody', async () => {
		await setSettings({ digestFrequency: 'daily', emailSystem: true, lastDigestAt: null });
		await seedNotification(new Date(Date.now() - HOUR));

		const first = await runDigest('daily');
		const second = await runDigest('daily');

		expect(first.sent).toBe(1);
		expect(second).toMatchObject({ claimed: 0, sent: 0 });
		expect(await deliveries()).toHaveLength(1);
	});

	it('claims a user with nothing to report but sends nothing', async () => {
		await setSettings({ digestFrequency: 'daily', emailSystem: true, lastDigestAt: null });

		const result = await runDigest('daily');
		expect(result).toMatchObject({ claimed: 1, sent: 0, empty: 1 });
		expect(await deliveries()).toHaveLength(0);
	});

	it('does not touch instant or never subscribers', async () => {
		await setSettings({ digestFrequency: 'instant', emailSystem: true });
		await seedNotification(new Date(Date.now() - HOUR));
		expect(await runDigest('daily')).toMatchObject({ claimed: 0 });

		await setSettings({ digestFrequency: 'never', emailSystem: true });
		expect(await runDigest('daily')).toMatchObject({ claimed: 0 });
	});

	it('weekly subscribers are not claimed by the daily pass', async () => {
		await setSettings({ digestFrequency: 'weekly', emailSystem: true, lastDigestAt: null });
		await seedNotification(new Date(Date.now() - HOUR));

		expect(await runDigest('daily')).toMatchObject({ claimed: 0 });
		expect(await runDigest('weekly')).toMatchObject({ claimed: 1, sent: 1 });
	});

	it('a weekly user inside their window is not re-claimed', async () => {
		// Sent 2 days ago — inside the 7-day window, so not yet due.
		await setSettings({
			digestFrequency: 'weekly',
			emailSystem: true,
			lastDigestAt: new Date(Date.now() - 2 * 24 * HOUR),
		});
		await seedNotification(new Date(Date.now() - HOUR));

		expect(await runDigest('weekly')).toMatchObject({ claimed: 0 });
	});

	it('only aggregates notifications newer than the previous digest', async () => {
		// 30h ago: older than the 24h cutoff, so this user IS due again.
		const lastDigestAt = new Date(Date.now() - 30 * HOUR);
		await setSettings({ digestFrequency: 'daily', emailSystem: true, lastDigestAt });
		// Predates the last digest — already reported, must not repeat. Note this
		// also predates the 24h cutoff, so the lower bound has to be the stored
		// `lastDigestAt`, not the window.
		await seedNotification(new Date(Date.now() - 40 * HOUR));
		await seedNotification(new Date(Date.now() - HOUR));

		await runDigest('daily');

		const [row] = await deliveries();
		// The subject carrier records the count that was actually included.
		const [carrier] = await db.select().from(notifications).where(eq(notifications.messageKey, 'notif_digest_subject'));
		expect((carrier?.messageParams as { count: number }).count).toBe(1);
		expect(row?.bodyOverride?.split('•')).toHaveLength(2); // intro + one item
	});

	it('routes nothing when every channel is off', async () => {
		await setSettings({ digestFrequency: 'daily', emailSystem: false, lastDigestAt: null });
		await seedNotification(new Date(Date.now() - HOUR));

		expect(await runDigest('daily')).toMatchObject({ claimed: 1, sent: 0, empty: 1 });
		expect(await deliveries()).toHaveLength(0);
	});
});
