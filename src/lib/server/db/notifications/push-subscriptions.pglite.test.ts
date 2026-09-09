import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { user } from '$lib/server/db/schema/auth/_better-auth';
import { pushSubscriptions } from '$lib/server/db/schema/notifications/push-subscriptions';
import { makeUser } from '$lib/server/test/fixtures';

let testClient: PGlite;

vi.mock('$lib/server/db', async () => {
	const { createTestDb } = await import('$lib/server/test/db');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

const { createPushSubscription, deletePushSubscription, deletePushSubscriptionByEndpoint } = await import(
	'./mutations'
);
const { getPushSubscriptions } = await import('./queries');
const { db } = await import('$lib/server/db');

const USER_A = makeUser({ id: 'user-push' });
const USER_B = makeUser({ id: 'user-push-b', email: 'push-b@example.com' });

const subInput = (endpoint: string) => ({ endpoint, p256dh: 'p256dh-key', auth: 'auth-key' });

describe('push subscription mutations', () => {
	beforeAll(async () => {
		await db.insert(user).values([USER_A, USER_B]);
	});

	afterAll(async () => {
		await testClient?.close();
	});

	beforeEach(async () => {
		await db.delete(pushSubscriptions);
	});

	it('creates a subscription per device and reads them back', async () => {
		await createPushSubscription(USER_A.id, subInput('https://push.example/dev-1'));
		await createPushSubscription(USER_A.id, subInput('https://push.example/dev-2'));

		const subs = await getPushSubscriptions(USER_A.id);
		expect(subs).toHaveLength(2);
	});

	it('re-subscribing the same endpoint updates keys instead of duplicating (unique endpoint)', async () => {
		await createPushSubscription(USER_A.id, subInput('https://push.example/dev-1'));
		await createPushSubscription(USER_A.id, { ...subInput('https://push.example/dev-1'), p256dh: 'rotated' });

		const subs = await getPushSubscriptions(USER_A.id);
		expect(subs).toHaveLength(1);
		expect(subs[0].p256dh).toBe('rotated');
	});

	it('enforces the per-user cap by evicting the oldest subscriptions', async () => {
		for (let i = 0; i < 12; i++) {
			await createPushSubscription(USER_A.id, subInput(`https://push.example/dev-${i}`));
		}

		const subs = await getPushSubscriptions(USER_A.id);
		expect(subs.length).toBe(10);
		const endpoints = subs.map((s) => s.endpoint);
		expect(endpoints).not.toContain('https://push.example/dev-0');
		expect(endpoints).not.toContain('https://push.example/dev-1');
		expect(endpoints).toContain('https://push.example/dev-11');
	});

	it('delete is IDOR-safe: another user cannot remove the subscription', async () => {
		await createPushSubscription(USER_A.id, subInput('https://push.example/dev-1'));

		const removedByOther = await deletePushSubscription(USER_B.id, 'https://push.example/dev-1');
		expect(removedByOther).toBe(false);
		expect(await getPushSubscriptions(USER_A.id)).toHaveLength(1);

		const removedByOwner = await deletePushSubscription(USER_A.id, 'https://push.example/dev-1');
		expect(removedByOwner).toBe(true);
		expect(await getPushSubscriptions(USER_A.id)).toHaveLength(0);
	});

	it('prune-by-endpoint removes regardless of owner (410 path)', async () => {
		await createPushSubscription(USER_A.id, subInput('https://push.example/dead'));

		await deletePushSubscriptionByEndpoint('https://push.example/dead');
		expect(await getPushSubscriptions(USER_A.id)).toHaveLength(0);
	});
});
