/**
 * Capability grants — server-side mutations and queries.
 *
 * Source of truth: auth.grant table. Per-request cache is event.locals.grants
 * (populated by the populateGrants hook). On grant/revoke we hard-delete all
 * the user's sessions so the next request is unauthenticated → next sign-in
 * picks up fresh grants via populateGrants.
 *
 * Audit: every grant/revoke writes one admin.audit_log row via recordAuditEvent.
 */
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { recordAuditEvent } from '$lib/server/admin/audit';
import { db } from '$lib/server/db';
import { createId } from '$lib/server/db/id';
import { session } from '$lib/server/db/schema/auth/_better-auth';
import { grant } from '$lib/server/db/schema/auth/grant';

/** v1 grant kinds. Extend the enum in src/lib/server/db/schema/auth/grant.ts before adding a new value here. */
export type GrantKind = 'blog-author';

export const GRANT_KINDS: readonly GrantKind[] = ['blog-author'];

/** List the active grant kinds for a user. Used by populateGrants on every authenticated request. */
export async function listActiveGrantKinds(userId: string): Promise<GrantKind[]> {
	const rows = await db
		.select({ kind: grant.kind })
		.from(grant)
		.where(and(eq(grant.userId, userId), isNull(grant.revokedAt)));
	return rows.map((r) => r.kind);
}

interface GrantActor {
	id: string;
	email: string;
}

interface GrantParams {
	userId: string;
	kind: GrantKind;
	actor: GrantActor;
	ipAddress?: string | null;
}

/**
 * Grant a capability to a user. If a revoked row exists, clears revokedAt
 * (re-grant). If an active row exists, no-op (idempotent). Force-revokes
 * the user's sessions so the new grant takes effect on the next sign-in.
 */
export async function grantCapability(params: GrantParams): Promise<void> {
	const { userId, kind, actor, ipAddress } = params;

	await db.transaction(async (tx) => {
		// Look for any existing row (active or revoked)
		const existing = await tx
			.select({ id: grant.id, revokedAt: grant.revokedAt })
			.from(grant)
			.where(and(eq(grant.userId, userId), eq(grant.kind, kind)))
			.limit(1);

		if (existing[0]) {
			if (existing[0].revokedAt === null) {
				// Already active — no-op
				return;
			}
			// Re-grant: clear revoked fields, reset grantedBy and grantedAt
			await tx
				.update(grant)
				.set({
					grantedAt: new Date(),
					grantedBy: actor.id,
					revokedAt: null,
					revokedBy: null,
					notifiedAt: null,
				})
				.where(eq(grant.id, existing[0].id));
		} else {
			await tx.insert(grant).values({
				id: createId.grant(),
				userId,
				kind,
				grantedBy: actor.id,
			});
		}
	});

	await recordAuditEvent({
		actorId: actor.id,
		actorEmail: actor.email,
		action: `grant.${kind}.grant`,
		targetType: 'auth.user',
		targetId: userId,
		ipAddress: ipAddress ?? undefined,
	});

	// Hard-delete all the user's sessions so the new grant is observable
	// after their next sign-in.
	await db.delete(session).where(eq(session.userId, userId));
}

interface RevokeParams {
	userId: string;
	kind: GrantKind;
	actor: GrantActor;
	ipAddress?: string | null;
}

/**
 * Revoke an active grant for a user. No-op if no active grant exists.
 * Force-revokes the user's sessions so the revoke takes immediate effect.
 */
export async function revokeCapability(params: RevokeParams): Promise<void> {
	const { userId, kind, actor, ipAddress } = params;

	const updated = await db
		.update(grant)
		.set({ revokedAt: new Date(), revokedBy: actor.id })
		.where(and(eq(grant.userId, userId), eq(grant.kind, kind), isNull(grant.revokedAt)))
		.returning({ id: grant.id });

	if (updated.length === 0) return; // nothing to do

	await recordAuditEvent({
		actorId: actor.id,
		actorEmail: actor.email,
		action: `grant.${kind}.revoke`,
		targetType: 'auth.user',
		targetId: userId,
		ipAddress: ipAddress ?? undefined,
	});

	await db.delete(session).where(eq(session.userId, userId));
}

export async function hasGrant(userId: string, kind: GrantKind): Promise<boolean> {
	const rows = await db
		.select({ id: grant.id })
		.from(grant)
		.where(and(eq(grant.userId, userId), eq(grant.kind, kind), isNull(grant.revokedAt)))
		.limit(1);
	return rows.length > 0;
}

/** List all users with an active grant of the given kind (admin "list authors"). */
export async function listGrantedUsers(kind: GrantKind) {
	return db
		.select({
			id: grant.id,
			userId: grant.userId,
			grantedAt: grant.grantedAt,
			grantedBy: grant.grantedBy,
			notifiedAt: grant.notifiedAt,
		})
		.from(grant)
		.where(and(eq(grant.kind, kind), isNull(grant.revokedAt)))
		.orderBy(grant.grantedAt);
}

export async function listGrantsForUser(userId: string) {
	return db.select().from(grant).where(eq(grant.userId, userId)).orderBy(grant.grantedAt);
}

/**
 * Mark a grant's notification as delivered. Called by the desk layout
 * after rendering the "you have access" Toast on the first /desk visit
 * after grant. Single-fire — subsequent calls are no-ops.
 */
export async function markGrantNotified(userId: string, kind: GrantKind): Promise<void> {
	await db
		.update(grant)
		.set({ notifiedAt: new Date() })
		.where(and(eq(grant.userId, userId), eq(grant.kind, kind), isNull(grant.revokedAt), isNull(grant.notifiedAt)));
}

/** Read the pending notification (if any) and clear it in one operation. */
export async function consumePendingGrantNotifications(userId: string): Promise<GrantKind[]> {
	const pending = await db
		.select({ kind: grant.kind })
		.from(grant)
		.where(and(eq(grant.userId, userId), isNull(grant.revokedAt), isNull(grant.notifiedAt)));

	if (pending.length === 0) return [];

	const kinds = pending.map((r) => r.kind);
	// Mark exactly the kinds we just read as notified in a single UPDATE instead of
	// one round-trip per kind. Scoping to `kinds` preserves the original semantics:
	// a grant arriving between the read and this write is not silently suppressed.
	await db
		.update(grant)
		.set({ notifiedAt: new Date() })
		.where(
			and(eq(grant.userId, userId), inArray(grant.kind, kinds), isNull(grant.revokedAt), isNull(grant.notifiedAt)),
		);

	return kinds;
}
