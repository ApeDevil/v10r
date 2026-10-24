import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { session, user } from '#lib/server/db/schema/auth/_better-auth.ts';
import { grant } from '#lib/server/db/schema/auth/grant.ts';
import { grantRequest } from '#lib/server/db/schema/auth/grant-request.ts';
import { makeUser } from '#lib/server/test/fixtures.ts';

/**
 * The capability-grant lifecycle, against real Postgres.
 *
 * This is an authorization state machine — request → approve/deny/expire → grant →
 * revoke → re-grant — and every transition is a `WHERE status = 'pending'` guarded
 * UPDATE whose correctness is the SQL, not the TypeScript. Three properties are only
 * observable here:
 *
 *  1. **One pending request per (user, kind)**, enforced by a partial unique index. The
 *     code catches SQLSTATE 23505 on that specific constraint name — if the index or the
 *     name changes, the catch silently stops matching and a duplicate request 500s.
 *  2. **Resolution is single-shot.** Approve and deny both filter on `status = 'pending'`,
 *     so a double-approve must throw rather than re-run `grantCapability`.
 *  3. **Granting and revoking hard-delete the user's sessions**, which is what makes a
 *     capability change take effect rather than sit behind a live session.
 *  4. **The grant notification is read and acknowledged separately.** The /desk layout
 *     load reads it and may run speculatively (hover preload), so reading must not mark
 *     it seen; acknowledging is a `notified_at IS NULL` guarded UPDATE, hence idempotent.
 *
 * `recordAuditEvent` is mocked: it writes to a different domain, and what matters here is
 * that the grant transitions happen, not that the audit row is shaped correctly.
 */
let testClient: PGlite;

vi.mock('#lib/server/db/index.ts', async () => {
	const { createTestDb } = await import('#lib/server/test/db.ts');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});
const audit = vi.hoisted(() => ({ events: [] as { action: string; targetId?: string }[] }));
vi.mock('#lib/server/admin/audit.ts', () => ({
	recordAuditEvent: vi.fn(async (e: { action: string; targetId?: string }) => {
		audit.events.push(e);
	}),
}));

const grants = await import('./grants');
const requests = await import('./grant-requests');
const { db } = await import('#lib/server/db/index.ts');

const USER = makeUser({ id: 'user-grantee' });
const OTHER = makeUser({ id: 'user-other' });
const ACTOR = { id: 'user-admin', email: 'admin@example.com' };

beforeEach(async () => {
	await db.delete(grantRequest);
	await db.delete(grant);
	await db.delete(session);
	await db.delete(user);
	await db.insert(user).values([USER, OTHER, makeUser({ id: ACTOR.id, email: ACTOR.email })]);
	audit.events.length = 0;
});

afterAll(async () => {
	await testClient?.close();
});

const openSession = (userId: string, token: string) =>
	db.insert(session).values({
		id: `ses_${token}`,
		userId,
		token,
		expiresAt: new Date(Date.now() + 3_600_000),
		createdAt: new Date(),
		updatedAt: new Date(),
	});

describe('grantCapability', () => {
	it('grants, and hard-deletes the user’s sessions so the grant takes effect', async () => {
		await openSession(USER.id, 'tok-a');
		await openSession(OTHER.id, 'tok-b');

		await grants.grantCapability({ userId: USER.id, kind: 'blog-author', actor: ACTOR });

		expect(await grants.hasGrant(USER.id, 'blog-author')).toBe(true);
		const remaining = await db.select().from(session);
		expect(remaining.map((s) => s.userId)).toEqual([OTHER.id]);
	});

	it('is idempotent — a second grant does not create a second row', async () => {
		await grants.grantCapability({ userId: USER.id, kind: 'blog-author', actor: ACTOR });
		await grants.grantCapability({ userId: USER.id, kind: 'blog-author', actor: ACTOR });

		expect(await db.select().from(grant)).toHaveLength(1);
		expect(await grants.listActiveGrantKinds(USER.id)).toEqual(['blog-author']);
	});

	it('re-grants a revoked row in place, clearing the revocation', async () => {
		await grants.grantCapability({ userId: USER.id, kind: 'blog-author', actor: ACTOR });
		await grants.revokeCapability({ userId: USER.id, kind: 'blog-author', actor: ACTOR });
		expect(await grants.hasGrant(USER.id, 'blog-author')).toBe(false);

		await grants.grantCapability({ userId: USER.id, kind: 'blog-author', actor: ACTOR });

		const rows = await db.select().from(grant);
		expect(rows).toHaveLength(1);
		expect(rows[0].revokedAt).toBeNull();
		expect(rows[0].revokedBy).toBeNull();
		expect(await grants.hasGrant(USER.id, 'blog-author')).toBe(true);
	});

	it('scopes by user — granting one user does not grant another', async () => {
		await grants.grantCapability({ userId: USER.id, kind: 'blog-author', actor: ACTOR });
		expect(await grants.hasGrant(OTHER.id, 'blog-author')).toBe(false);
		expect(await grants.listActiveGrantKinds(OTHER.id)).toEqual([]);
	});
});

describe('revokeCapability', () => {
	it('revokes an active grant and clears the user’s sessions', async () => {
		await grants.grantCapability({ userId: USER.id, kind: 'blog-author', actor: ACTOR });
		await openSession(USER.id, 'tok-c');

		await grants.revokeCapability({ userId: USER.id, kind: 'blog-author', actor: ACTOR });

		expect(await grants.hasGrant(USER.id, 'blog-author')).toBe(false);
		expect(await db.select().from(session)).toHaveLength(0);
	});

	it('is a no-op with no audit event when there is nothing active to revoke', async () => {
		audit.events.length = 0;
		await grants.revokeCapability({ userId: USER.id, kind: 'blog-author', actor: ACTOR });
		expect(audit.events).toEqual([]);
	});
});

describe('grant requests', () => {
	it('allows one pending request per (user, kind) and rejects the second', async () => {
		await requests.createGrantRequest({ userId: USER.id, kind: 'blog-author' });

		await expect(requests.createGrantRequest({ userId: USER.id, kind: 'blog-author' })).rejects.toBeInstanceOf(
			requests.GrantRequestPendingError,
		);
	});

	it('allows a NEW request once the previous one is resolved', async () => {
		const { id } = await requests.createGrantRequest({ userId: USER.id, kind: 'blog-author' });
		await requests.denyRequest({ requestId: id, actor: ACTOR });

		await expect(requests.createGrantRequest({ userId: USER.id, kind: 'blog-author' })).resolves.toBeDefined();
	});

	it('approving cascades to a real grant', async () => {
		const { id } = await requests.createGrantRequest({ userId: USER.id, kind: 'blog-author' });

		await requests.approveRequest({ requestId: id, actor: ACTOR });

		expect(await grants.hasGrant(USER.id, 'blog-author')).toBe(true);
		const [row] = await db.select().from(grantRequest).where(eq(grantRequest.id, id));
		expect(row.status).toBe('approved');
		expect(row.resolvedBy).toBe(ACTOR.id);
	});

	it('denying does NOT grant', async () => {
		const { id } = await requests.createGrantRequest({ userId: USER.id, kind: 'blog-author' });

		await requests.denyRequest({ requestId: id, actor: ACTOR, reason: 'not yet' });

		expect(await grants.hasGrant(USER.id, 'blog-author')).toBe(false);
		const [row] = await db.select().from(grantRequest).where(eq(grantRequest.id, id));
		expect(row.status).toBe('denied');
	});

	it('resolution is single-shot — a second approve throws instead of re-granting', async () => {
		const { id } = await requests.createGrantRequest({ userId: USER.id, kind: 'blog-author' });
		await requests.approveRequest({ requestId: id, actor: ACTOR });

		await expect(requests.approveRequest({ requestId: id, actor: ACTOR })).rejects.toThrow(
			/not found or already resolved/,
		);
		await expect(requests.denyRequest({ requestId: id, actor: ACTOR })).rejects.toThrow(
			/not found or already resolved/,
		);
	});

	it('cancelMyPendingRequest is user-scoped — another user cannot cancel it', async () => {
		await requests.createGrantRequest({ userId: USER.id, kind: 'blog-author' });

		expect(await requests.cancelMyPendingRequest(OTHER.id, 'blog-author')).toBe(false);
		expect(await requests.countPendingRequests()).toBe(1);

		expect(await requests.cancelMyPendingRequest(USER.id, 'blog-author')).toBe(true);
		expect(await requests.countPendingRequests()).toBe(0);
	});

	it('countPendingRequests and listPendingRequests see only pending rows', async () => {
		const { id } = await requests.createGrantRequest({ userId: USER.id, kind: 'blog-author' });
		await requests.createGrantRequest({ userId: OTHER.id, kind: 'blog-author' });
		expect(await requests.countPendingRequests()).toBe(2);

		await requests.approveRequest({ requestId: id, actor: ACTOR });

		expect(await requests.countPendingRequests()).toBe(1);
		expect((await requests.listPendingRequests()).map((r) => r.userId)).toEqual([OTHER.id]);
	});
});

describe('expireOldRequests', () => {
	const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

	it('soft-denies only requests older than the expiry window', async () => {
		const { id: old } = await requests.createGrantRequest({ userId: USER.id, kind: 'blog-author' });
		const { id: fresh } = await requests.createGrantRequest({ userId: OTHER.id, kind: 'blog-author' });
		await db
			.update(grantRequest)
			.set({ requestedAt: daysAgo(requests.REQUEST_EXPIRY_DAYS + 1) })
			.where(eq(grantRequest.id, old));

		expect(await requests.expireOldRequests()).toBe(1);

		const [expired] = await db.select().from(grantRequest).where(eq(grantRequest.id, old));
		const [kept] = await db.select().from(grantRequest).where(eq(grantRequest.id, fresh));
		expect(expired.status).toBe('denied');
		// resolvedBy NULL is the system sentinel — an expiry was nobody's decision.
		expect(expired.resolvedBy).toBeNull();
		expect(kept.status).toBe('pending');
	});

	it('does not expire a request sitting exactly inside the window', async () => {
		const { id } = await requests.createGrantRequest({ userId: USER.id, kind: 'blog-author' });
		await db
			.update(grantRequest)
			.set({ requestedAt: daysAgo(requests.REQUEST_EXPIRY_DAYS - 1) })
			.where(eq(grantRequest.id, id));

		expect(await requests.expireOldRequests()).toBe(0);
	});

	it('never expires an already-resolved request', async () => {
		const { id } = await requests.createGrantRequest({ userId: USER.id, kind: 'blog-author' });
		await requests.approveRequest({ requestId: id, actor: ACTOR });
		await db
			.update(grantRequest)
			.set({ requestedAt: daysAgo(requests.REQUEST_EXPIRY_DAYS + 5) })
			.where(eq(grantRequest.id, id));

		expect(await requests.expireOldRequests()).toBe(0);
		const [row] = await db.select().from(grantRequest).where(eq(grantRequest.id, id));
		expect(row.status).toBe('approved');
	});
});

describe('grant notifications', () => {
	const grantBlogAuthor = (userId: string) => grants.grantCapability({ userId, kind: 'blog-author', actor: ACTOR });

	it('reading pending notifications does not consume them — a preloaded load leaves the Toast for the real visit', async () => {
		await grantBlogAuthor(USER.id);

		expect(await grants.listPendingGrantNotifications(USER.id)).toEqual(['blog-author']);
		expect(await grants.listPendingGrantNotifications(USER.id)).toEqual(['blog-author']);
		const [row] = await db.select().from(grant);
		expect(row.notifiedAt).toBeNull();
	});

	it('acknowledging marks the notification seen, and a second acknowledgement is a no-op', async () => {
		await grantBlogAuthor(USER.id);

		expect(await grants.acknowledgeGrantNotifications(USER.id, ['blog-author'])).toEqual(['blog-author']);
		expect(await grants.listPendingGrantNotifications(USER.id)).toEqual([]);
		const [first] = await db.select().from(grant);
		expect(first.notifiedAt).toBeInstanceOf(Date);

		expect(await grants.acknowledgeGrantNotifications(USER.id, ['blog-author'])).toEqual([]);
		const [second] = await db.select().from(grant);
		expect(second.notifiedAt).toEqual(first.notifiedAt);
	});

	it('acknowledging with nothing pending — no grant, a revoked grant, or no kinds — is a no-op', async () => {
		expect(await grants.acknowledgeGrantNotifications(USER.id, ['blog-author'])).toEqual([]);
		expect(await grants.acknowledgeGrantNotifications(USER.id, [])).toEqual([]);

		await grantBlogAuthor(USER.id);
		await grants.revokeCapability({ userId: USER.id, kind: 'blog-author', actor: ACTOR });
		expect(await grants.listPendingGrantNotifications(USER.id)).toEqual([]);
		expect(await grants.acknowledgeGrantNotifications(USER.id, ['blog-author'])).toEqual([]);
		const [row] = await db.select().from(grant);
		expect(row.notifiedAt).toBeNull();
	});

	it('is user-scoped — acknowledging one user leaves another user’s notification pending', async () => {
		await grantBlogAuthor(USER.id);
		await grantBlogAuthor(OTHER.id);

		await grants.acknowledgeGrantNotifications(USER.id, ['blog-author']);
		expect(await grants.listPendingGrantNotifications(USER.id)).toEqual([]);
		expect(await grants.listPendingGrantNotifications(OTHER.id)).toEqual(['blog-author']);
	});

	it('a re-grant after revocation notifies again', async () => {
		await grantBlogAuthor(USER.id);
		await grants.acknowledgeGrantNotifications(USER.id, ['blog-author']);
		await grants.revokeCapability({ userId: USER.id, kind: 'blog-author', actor: ACTOR });
		await grantBlogAuthor(USER.id);

		expect(await grants.listPendingGrantNotifications(USER.id)).toEqual(['blog-author']);
	});
});
