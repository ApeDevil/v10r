import type { PGlite } from '@electric-sql/pglite';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DELIVERY_CLAIM_LEASE_MS, DELIVERY_MAX_ATTEMPTS } from '$lib/server/config';
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

const { createDeliveries, claimDeliveries, markSent, markFailed, reclaimStaleDeliveries } = await import('./outbox');
const { backoffMs } = await import('./backoff');
const { db } = await import('$lib/server/db');

const USER_A = makeUser({ id: 'user-outbox' });

/** Read one row back by id. */
async function row(id: string) {
	const [r] = await db.select().from(notificationDeliveries).where(eq(notificationDeliveries.id, id));
	return r;
}

/** Shift a row's timestamps/state directly, bypassing the queue API. */
async function patch(id: string, values: Record<string, unknown>) {
	await db
		.update(notificationDeliveries)
		.set(values as never)
		.where(eq(notificationDeliveries.id, id));
}

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

		it('makes new rows immediately due', async () => {
			const [delivery] = await createDeliveries(notificationId, ['email']);
			const r = await row(delivery.id);
			expect(r.nextAttemptAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
		});
	});

	describe('claimDeliveries', () => {
		it('claims a due pending row and transitions it', async () => {
			const [delivery] = await createDeliveries(notificationId, ['email']);

			const claims = await claimDeliveries(10);
			expect(claims).toHaveLength(1);

			const r = await row(delivery.id);
			expect(r.status).toBe('processing');
			expect(r.attempts).toBe(1);
			expect(r.attemptedAt).toBeTruthy();
		});

		it('does NOT claim a row whose backoff has not elapsed', async () => {
			// The headline fix: before this change a failed row was re-picked on the
			// very next tick, burning the whole attempt budget in seconds.
			const [delivery] = await createDeliveries(notificationId, ['email']);
			await patch(delivery.id, { nextAttemptAt: sql`now() + interval '60 seconds'` });

			expect(await claimDeliveries(10)).toHaveLength(0);
			expect((await row(delivery.id)).status).toBe('pending');
		});

		it('ignores rows that are not pending', async () => {
			const [a, b] = await createDeliveries(notificationId, ['email', 'discord']);
			await patch(a.id, { status: 'sent' });
			await patch(b.id, { status: 'dead' });

			expect(await claimDeliveries(10)).toHaveLength(0);
		});

		it('returns the joined notification fields under camelCase aliases', async () => {
			// A dropped double-quote in the RETURNING clause folds the alias to
			// lowercase, still type-checks, and yields undefined at runtime.
			await createDeliveries(notificationId, ['email']);
			const [claim] = await claimDeliveries(1);

			expect(claim.notificationId).toBe(notificationId);
			expect(claim.userId).toBe(USER_A.id);
			expect(claim.messageKey).toBeDefined();
			expect(claim.messageParams).toBeDefined();
			expect(claim.channel).toBe('email');
			expect(typeof claim.attempts).toBe('number');
		});

		it('honours the batch size and ordering', async () => {
			await createDeliveries(notificationId, ['email', 'telegram', 'discord']);
			const all = await db.select().from(notificationDeliveries);
			// Make the last row the most overdue so ordering is observable.
			await patch(all[2].id, { nextAttemptAt: sql`now() - interval '10 minutes'` });

			const claims = await claimDeliveries(2);
			expect(claims).toHaveLength(2);
			expect(claims[0].id).toBe(all[2].id);
		});

		it('returns nothing for a non-positive batch size', async () => {
			await createDeliveries(notificationId, ['email']);
			expect(await claimDeliveries(0)).toEqual([]);
			expect(await claimDeliveries(-1)).toEqual([]);
		});

		it('is a state transition, not a read — a second claim gets nothing', async () => {
			// The achievable proxy for atomicity on a single-connection driver.
			await createDeliveries(notificationId, ['email']);

			expect(await claimDeliveries(10)).toHaveLength(1);
			expect(await claimDeliveries(10)).toHaveLength(0);
		});

		it('never hands the same row to two claimers', async () => {
			// NOTE: PGlite is single-connection, so SKIP LOCKED parses and runs but can
			// never actually skip — this passes here via serialization. The assertion is
			// written so it becomes a real SKIP LOCKED test if the harness ever gains
			// true concurrency. Verify the real behaviour manually against Neon.
			await createDeliveries(notificationId, ['email', 'telegram', 'discord']);

			const [first, second] = await Promise.all([claimDeliveries(10), claimDeliveries(10)]);
			const overlap = first.filter((f) => second.some((s) => s.id === f.id));
			expect(overlap).toEqual([]);
			expect(first.length + second.length).toBe(3);
		});
	});

	describe('markSent', () => {
		it('applies under a valid fence and clears any prior error', async () => {
			const [delivery] = await createDeliveries(notificationId, ['email']);
			await patch(delivery.id, { errorCode: 'OLD', errorMessage: 'stale' });
			const [claim] = await claimDeliveries(1);

			expect(await markSent(claim, 'provider-123')).toBe(true);

			const r = await row(delivery.id);
			expect(r.status).toBe('sent');
			expect(r.sentAt).toBeTruthy();
			expect(r.providerMessageId).toBe('provider-123');
			expect(r.errorCode).toBeNull();
			expect(r.errorMessage).toBeNull();
		});

		it('is rejected when the fence is stale', async () => {
			const [delivery] = await createDeliveries(notificationId, ['email']);
			const [claim] = await claimDeliveries(1);
			// Someone re-claimed the row behind this worker's back.
			await patch(delivery.id, { attempts: claim.attempts + 1 });

			expect(await markSent(claim)).toBe(false);
			expect((await row(delivery.id)).status).toBe('processing');
		});

		it('still lands after the reaper requeued the row', async () => {
			// Prevents the worst duplicate: the lease lapsed, the reaper requeued, and
			// the original worker then reports success. That success must win, or the
			// message is sent a second time.
			const [delivery] = await createDeliveries(notificationId, ['email']);
			const [claim] = await claimDeliveries(1);
			await patch(delivery.id, { status: 'pending' });

			expect(await markSent(claim)).toBe(true);
			expect((await row(delivery.id)).status).toBe('sent');
		});
	});

	describe('markFailed', () => {
		it('requeues with a backoff while budget remains', async () => {
			const [delivery] = await createDeliveries(notificationId, ['email']);
			const [claim] = await claimDeliveries(1);

			const decision = await markFailed(claim, 'SMTP_ERR', 'Connection refused', true);
			expect(decision?.status).toBe('pending');

			const r = await row(delivery.id);
			expect(r.status).toBe('pending');
			expect(r.errorCode).toBe('SMTP_ERR');

			const delay = backoffMs(claim.attempts);
			const due = r.nextAttemptAt.getTime() - Date.now();
			expect(due).toBeGreaterThan(delay * 0.85 - 2000);
			expect(due).toBeLessThan(delay * 1.15 + 2000);
		});

		it('dead-letters once the attempt budget is spent', async () => {
			const [delivery] = await createDeliveries(notificationId, ['email']);
			await patch(delivery.id, { attempts: DELIVERY_MAX_ATTEMPTS - 1 });
			const [claim] = await claimDeliveries(1);

			expect(claim.attempts).toBe(DELIVERY_MAX_ATTEMPTS);
			await markFailed(claim, 'SMTP_ERR', 'Connection refused', true);

			// 'dead', not 'failed' — this is what lights up the admin panel.
			expect((await row(delivery.id)).status).toBe('dead');
		});

		it('fails permanently when the provider says it is not retryable', async () => {
			const [delivery] = await createDeliveries(notificationId, ['email']);
			const [claim] = await claimDeliveries(1);

			await markFailed(claim, 'INVALID', 'Bad address', false);
			expect((await row(delivery.id)).status).toBe('failed');
		});

		it('is rejected when the fence is stale', async () => {
			const [delivery] = await createDeliveries(notificationId, ['email']);
			const [claim] = await claimDeliveries(1);
			await patch(delivery.id, { attempts: claim.attempts + 1 });

			expect(await markFailed(claim, 'SMTP_ERR', 'nope', true)).toBeNull();
			expect((await row(delivery.id)).errorCode).toBeNull();
		});
	});

	describe('reclaimStaleDeliveries', () => {
		/** Put a row into 'processing' with a claim `ageMs` old. */
		async function stale(id: string, ageMs: number, attempts = 1) {
			await patch(id, {
				status: 'processing',
				attempts,
				attemptedAt: sql`now() - make_interval(secs => ${ageMs / 1000})`,
			});
		}

		it('requeues a row whose lease lapsed', async () => {
			const [delivery] = await createDeliveries(notificationId, ['email']);
			await stale(delivery.id, DELIVERY_CLAIM_LEASE_MS + 1000);

			expect(await reclaimStaleDeliveries()).toBe(1);

			const r = await row(delivery.id);
			expect(r.status).toBe('pending');
			expect(r.errorCode).toBe('CLAIM_EXPIRED');
			expect(r.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + backoffMs(1) * 0.5);
		});

		it('leaves a row that is legitimately mid-send alone', async () => {
			const [delivery] = await createDeliveries(notificationId, ['email']);
			await stale(delivery.id, DELIVERY_CLAIM_LEASE_MS - 60_000);

			expect(await reclaimStaleDeliveries()).toBe(0);
			expect((await row(delivery.id)).status).toBe('processing');
		});

		it('dead-letters instead of requeueing when the budget is spent', async () => {
			const [delivery] = await createDeliveries(notificationId, ['email']);
			await stale(delivery.id, DELIVERY_CLAIM_LEASE_MS + 1000, DELIVERY_MAX_ATTEMPTS);

			await reclaimStaleDeliveries();
			expect((await row(delivery.id)).status).toBe('dead');
		});

		it('does not bump attempts — the claim already counted them', async () => {
			const [delivery] = await createDeliveries(notificationId, ['email']);
			await stale(delivery.id, DELIVERY_CLAIM_LEASE_MS + 1000, 2);

			await reclaimStaleDeliveries();
			expect((await row(delivery.id)).attempts).toBe(2);
		});

		it('rescues a legacy row that has no claim stamp', async () => {
			const [delivery] = await createDeliveries(notificationId, ['email']);
			await patch(delivery.id, {
				status: 'processing',
				attemptedAt: null,
				createdAt: sql`now() - interval '1 day'`,
			});

			expect(await reclaimStaleDeliveries()).toBe(1);
			expect((await row(delivery.id)).status).toBe('pending');
		});

		it('never touches a row in any other status', async () => {
			const [a, b, c] = await createDeliveries(notificationId, ['email', 'telegram', 'discord']);
			await patch(a.id, { status: 'sent', attemptedAt: sql`now() - interval '1 day'` });
			await patch(b.id, { status: 'failed', attemptedAt: sql`now() - interval '1 day'` });
			await patch(c.id, { status: 'pending', attemptedAt: sql`now() - interval '1 day'` });

			expect(await reclaimStaleDeliveries()).toBe(0);
			expect((await row(a.id)).status).toBe('sent');
			expect((await row(b.id)).status).toBe('failed');
			expect((await row(c.id)).status).toBe('pending');
		});
	});
});
