import type { PGlite } from '@electric-sql/pglite';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DELIVERY_CLAIM_LEASE_MS, DELIVERY_MAX_ATTEMPTS } from '$lib/server/config';
import { user } from '$lib/server/db/schema/auth/_better-auth';
import { notificationDeliveries } from '$lib/server/db/schema/notifications/deliveries';
import { notifications } from '$lib/server/db/schema/notifications/notifications';
import { userTelegramAccounts } from '$lib/server/db/schema/notifications/telegram';
import type { DeliveryResult } from '$lib/server/notifications/providers/types';
import { makeNotification, makeUser } from '$lib/server/test/fixtures';

let testClient: PGlite;

vi.mock('$lib/server/db', async () => {
	const { createTestDb } = await import('$lib/server/test/db');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

/** Scripted provider: each test sets `nextResult` (or makes send throw). */
let nextResult: DeliveryResult = { success: true, providerMessageId: 'ok-1' };
let sendImpl: (() => Promise<DeliveryResult>) | null = null;
let sendCalls = 0;
let knownChannels = new Set(['email', 'telegram', 'discord', 'push']);

vi.mock('$lib/server/notifications/providers', () => ({
	getProvider: (channel: string) =>
		knownChannels.has(channel)
			? {
					send: async () => {
						sendCalls++;
						if (sendImpl) return sendImpl();
						return nextResult;
					},
					validateConnection: async () => true,
					getProviderName: () => `fake-${channel}`,
				}
			: undefined,
}));

const { notificationDelivery } = await import('./notification-delivery');
const { db } = await import('$lib/server/db');

const USER_A = makeUser({ id: 'user-delivery' });

async function row(id: string) {
	const [r] = await db.select().from(notificationDeliveries).where(eq(notificationDeliveries.id, id));
	return r;
}

async function seedDelivery(channel: 'email' | 'telegram' | 'discord', notificationId: string) {
	const id = crypto.randomUUID();
	await db.insert(notificationDeliveries).values({ id, notificationId, channel });
	return id;
}

describe('notificationDelivery worker', () => {
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
		await db.delete(userTelegramAccounts);

		const n = makeNotification({ userId: USER_A.id });
		await db.insert(notifications).values(n);
		notificationId = n.id;

		nextResult = { success: true, providerMessageId: 'ok-1' };
		sendImpl = null;
		sendCalls = 0;
		knownChannels = new Set(['email', 'telegram', 'discord', 'push']);
	});

	it('delivers a pending row and marks it sent', async () => {
		const id = await seedDelivery('email', notificationId);

		expect(await notificationDelivery()).toBe(1);

		const r = await row(id);
		expect(r.status).toBe('sent');
		expect(r.providerMessageId).toBe('ok-1');
		expect(r.attempts).toBe(1);
	});

	it('returns 0 when the queue is empty', async () => {
		expect(await notificationDelivery()).toBe(0);
		expect(sendCalls).toBe(0);
	});

	it('holds a failed row back until its backoff elapses', async () => {
		// The end-to-end proof of the original bug: before backoff, the very next
		// tick re-picked the row and burned the whole budget in seconds.
		const id = await seedDelivery('email', notificationId);
		nextResult = { success: false, errorCode: 'SMTP_ERR', errorMessage: 'refused', retryable: true };

		expect(await notificationDelivery()).toBe(1);
		expect((await row(id)).status).toBe('pending');

		const callsAfterFirst = sendCalls;
		expect(await notificationDelivery()).toBe(0);
		expect(sendCalls).toBe(callsAfterFirst);
	});

	it('dead-letters once the attempt budget is spent', async () => {
		const id = await seedDelivery('email', notificationId);
		await db
			.update(notificationDeliveries)
			.set({ attempts: DELIVERY_MAX_ATTEMPTS - 1 })
			.where(eq(notificationDeliveries.id, id));
		nextResult = { success: false, errorCode: 'SMTP_ERR', errorMessage: 'refused', retryable: true };

		await notificationDelivery();
		expect((await row(id)).status).toBe('dead');
	});

	it('fails permanently on a non-retryable provider result', async () => {
		const id = await seedDelivery('email', notificationId);
		nextResult = { success: false, errorCode: 'INVALID', errorMessage: 'bad address', retryable: false };

		await notificationDelivery();
		expect((await row(id)).status).toBe('failed');
	});

	it('counts the attempt when no provider exists for the channel', async () => {
		// Previously markFailed ran before markProcessing, so this path never
		// incremented attempts — a row could fail forever at attempts = 0.
		knownChannels = new Set(['telegram']);
		const id = await seedDelivery('email', notificationId);

		await notificationDelivery();

		const r = await row(id);
		expect(r.status).toBe('failed');
		expect(r.errorCode).toBe('NO_PROVIDER');
		expect(r.attempts).toBe(1);
	});

	it('fails a row with no resolvable recipient', async () => {
		// No telegram account row exists for this user.
		const id = await seedDelivery('telegram', notificationId);

		await notificationDelivery();

		const r = await row(id);
		expect(r.status).toBe('failed');
		expect(r.errorCode).toBe('NO_RECIPIENT');
	});

	it('contains a throwing provider to its own row', async () => {
		// With real claims, an uncaught throw would strand every remaining claimed
		// row in 'processing' until the reaper.
		const first = await seedDelivery('email', notificationId);
		const second = await seedDelivery('email', notificationId);
		let call = 0;
		sendImpl = async () => {
			call++;
			if (call === 1) throw new Error('provider exploded');
			return { success: true, providerMessageId: 'ok-2' };
		};

		expect(await notificationDelivery()).toBe(2);

		const a = await row(first);
		const b = await row(second);
		const statuses = [a.status, b.status].sort();
		expect(statuses).toEqual(['pending', 'sent']);

		const failed = a.status === 'pending' ? a : b;
		expect(failed.errorCode).toBe('WORKER_ERROR');
		expect(failed.errorMessage).toContain('provider exploded');
	});

	it('deactivates a telegram account on 403', async () => {
		await db.insert(userTelegramAccounts).values({
			id: crypto.randomUUID(),
			userId: USER_A.id,
			telegramChatId: '12345',
			isActive: true,
		});
		const id = await seedDelivery('telegram', notificationId);
		nextResult = { success: false, errorCode: '403', errorMessage: 'bot blocked', retryable: false };

		await notificationDelivery();

		expect((await row(id)).status).toBe('failed');
		const [account] = await db.select().from(userTelegramAccounts).where(eq(userTelegramAccounts.userId, USER_A.id));
		expect(account.isActive).toBe(false);
	});

	it('reclaims a lapsed claim before draining', async () => {
		const id = await seedDelivery('email', notificationId);
		await db
			.update(notificationDeliveries)
			.set({
				status: 'processing',
				attempts: 1,
				attemptedAt: sql`now() - make_interval(secs => ${DELIVERY_CLAIM_LEASE_MS / 1000 + 60})`,
			})
			.where(eq(notificationDeliveries.id, id));

		// Reclaimed with a future next_attempt_at, so it is NOT re-sent this tick.
		expect(await notificationDelivery()).toBe(0);

		const r = await row(id);
		expect(r.status).toBe('pending');
		expect(r.errorCode).toBe('CLAIM_EXPIRED');
	});

	it('does not stack overlapping drains in one process', async () => {
		await seedDelivery('email', notificationId);
		let release: () => void = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		sendImpl = async () => {
			await gate;
			return { success: true, providerMessageId: 'ok-slow' };
		};

		const first = notificationDelivery();
		const second = notificationDelivery();
		release();

		const [a, b] = await Promise.all([first, second]);
		expect([a, b].sort()).toEqual([0, 1]);
	});
});
