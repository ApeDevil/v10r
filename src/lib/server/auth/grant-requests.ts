/**
 * Self-service grant requests — server-side mutations and queries.
 *
 * Users post a request via /api/grant-requests; admins approve/deny
 * from /admin/access/requests. Approval cascades to grantCapability().
 *
 * Auto-expiry: expireOldRequests() soft-denies any pending request older
 * than 14 days. Runs every 6 hours via the existing job scheduler.
 */
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import { recordAuditEvent } from '$lib/server/admin/audit';
import { db } from '$lib/server/db';
import { createId } from '$lib/server/db/id';
import { user as userTable } from '$lib/server/db/schema/auth/_better-auth';
import { grantRequest } from '$lib/server/db/schema/auth/grant-request';
import { type GrantKind, grantCapability } from './grants';

export const REQUEST_EXPIRY_DAYS = 14;

interface CreateRequestParams {
	userId: string;
	kind: GrantKind;
	message?: string | null;
}

export class GrantRequestPendingError extends Error {
	readonly code = 'grant_request_pending' as const;
	constructor() {
		super('A pending request already exists for this user and kind');
	}
}

export class GrantAlreadyExistsError extends Error {
	readonly code = 'grant_already_exists' as const;
	constructor() {
		super('User already has an active grant for this kind');
	}
}

export async function createGrantRequest(params: CreateRequestParams): Promise<{ id: string }> {
	const { userId, kind, message } = params;

	try {
		const [inserted] = await db
			.insert(grantRequest)
			.values({
				id: createId.grantRequest(),
				userId,
				kind,
				message: message ?? null,
				status: 'pending',
			})
			.returning({ id: grantRequest.id });

		return { id: inserted.id };
	} catch (err) {
		if (isPgUniqueViolation(err, 'auth_grant_request_pending_uniq')) {
			throw new GrantRequestPendingError();
		}
		throw err;
	}
}

/**
 * Detect a Postgres unique-violation (SQLSTATE 23505) on a specific constraint.
 * Drizzle wraps the original `pg` error; the SQLSTATE + constraint name live on
 * the `cause` chain, not on the top-level message. Walks up to two cause levels
 * so it survives the wrap.
 */
function isPgUniqueViolation(err: unknown, constraintName: string): boolean {
	const codes: string[] = [];
	const names: string[] = [];
	let cur: unknown = err;
	for (let i = 0; i < 3 && cur && typeof cur === 'object'; i++) {
		const o = cur as {
			code?: string;
			constraint?: string;
			constraint_name?: string;
			message?: string;
			cause?: unknown;
		};
		if (o.code) codes.push(o.code);
		if (o.constraint) names.push(o.constraint);
		if (o.constraint_name) names.push(o.constraint_name);
		if (o.message?.includes(constraintName)) names.push(constraintName);
		cur = o.cause;
	}
	return codes.includes('23505') && names.includes(constraintName);
}

/** Get the user's pending request for a kind, or null. */
export async function getMyPendingRequest(userId: string, kind: GrantKind) {
	const rows = await db
		.select()
		.from(grantRequest)
		.where(and(eq(grantRequest.userId, userId), eq(grantRequest.kind, kind), eq(grantRequest.status, 'pending')))
		.limit(1);
	return rows[0] ?? null;
}

export async function listMyRequests(userId: string) {
	return db
		.select()
		.from(grantRequest)
		.where(eq(grantRequest.userId, userId))
		.orderBy(desc(grantRequest.requestedAt))
		.limit(50);
}

/** Admin: cancel one's own pending request. */
export async function cancelMyPendingRequest(userId: string, kind: GrantKind): Promise<boolean> {
	const updated = await db
		.delete(grantRequest)
		.where(and(eq(grantRequest.userId, userId), eq(grantRequest.kind, kind), eq(grantRequest.status, 'pending')))
		.returning({ id: grantRequest.id });
	return updated.length > 0;
}

interface AdminActor {
	id: string;
	email: string;
}

export async function listPendingRequests() {
	return db
		.select({
			id: grantRequest.id,
			userId: grantRequest.userId,
			userEmail: userTable.email,
			userName: userTable.name,
			kind: grantRequest.kind,
			message: grantRequest.message,
			requestedAt: grantRequest.requestedAt,
		})
		.from(grantRequest)
		.innerJoin(userTable, eq(grantRequest.userId, userTable.id))
		.where(eq(grantRequest.status, 'pending'))
		.orderBy(grantRequest.requestedAt);
}

interface ResolveParams {
	requestId: string;
	actor: AdminActor;
	ipAddress?: string | null;
}

export async function approveRequest(params: ResolveParams): Promise<void> {
	const { requestId, actor, ipAddress } = params;

	const rows = await db
		.update(grantRequest)
		.set({ status: 'approved', resolvedAt: new Date(), resolvedBy: actor.id })
		.where(and(eq(grantRequest.id, requestId), eq(grantRequest.status, 'pending')))
		.returning({ userId: grantRequest.userId, kind: grantRequest.kind });

	const req = rows[0];
	if (!req) {
		throw new Error('Request not found or already resolved');
	}

	await grantCapability({ userId: req.userId, kind: req.kind, actor, ipAddress });

	await recordAuditEvent({
		actorId: actor.id,
		actorEmail: actor.email,
		action: `grant_request.${req.kind}.approve`,
		targetType: 'auth.grant_request',
		targetId: requestId,
		ipAddress: ipAddress ?? undefined,
	});
}

export async function denyRequest(params: ResolveParams & { reason?: string }): Promise<void> {
	const { requestId, actor, ipAddress, reason } = params;

	const rows = await db
		.update(grantRequest)
		.set({ status: 'denied', resolvedAt: new Date(), resolvedBy: actor.id })
		.where(and(eq(grantRequest.id, requestId), eq(grantRequest.status, 'pending')))
		.returning({ userId: grantRequest.userId, kind: grantRequest.kind });

	const req = rows[0];
	if (!req) {
		throw new Error('Request not found or already resolved');
	}

	await recordAuditEvent({
		actorId: actor.id,
		actorEmail: actor.email,
		action: `grant_request.${req.kind}.deny`,
		targetType: 'auth.grant_request',
		targetId: requestId,
		detail: reason ? { reason } : undefined,
		ipAddress: ipAddress ?? undefined,
	});
}

/**
 * Cron-driven: soft-deny any pending request older than REQUEST_EXPIRY_DAYS.
 * resolvedBy = NULL is the system sentinel.
 */
export async function expireOldRequests(): Promise<number> {
	const cutoff = new Date(Date.now() - REQUEST_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

	const expired = await db
		.update(grantRequest)
		.set({ status: 'denied', resolvedAt: new Date(), resolvedBy: null })
		.where(and(eq(grantRequest.status, 'pending'), lt(grantRequest.requestedAt, cutoff)))
		.returning({ id: grantRequest.id });

	return expired.length;
}

export async function countPendingRequests(): Promise<number> {
	const rows = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(grantRequest)
		.where(eq(grantRequest.status, 'pending'));
	return rows[0]?.count ?? 0;
}
