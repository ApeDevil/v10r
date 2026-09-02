/**
 * dbops orchestrator — the single core called by the manual form action AND the
 * scheduled job. Executor model: lazy-advance-on-poll.
 *
 * `startOperation` fires the Neon restore (fast — returns operations[]) and
 * returns immediately with status `running`. `advanceOperation` (called from the
 * status endpoint on each poll, and from the scheduled job's drive loop) polls
 * the Neon operations and flips the operation to a terminal state. Lazy lease-expiry
 * in `advanceOperation` plus `reapExpiredOperations` recover crashed/abandoned operations.
 */
import { and, desc, eq, inArray, lt, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { createId } from '$lib/server/db/id';
import { type DbopsOperation, dbopsOperation } from '$lib/server/db/schema/dbops/operation';
import { sanitizeError } from '$lib/server/monitoring';
import {
	getOperation,
	hasChildren,
	NEON_OP_TERMINAL_FAIL,
	NEON_OP_TERMINAL_OK,
	neonConfigured,
	resolveTargets,
	restoreBranchFromParent,
} from '$lib/server/neon';
import {
	ConflictError,
	NotConfiguredError,
	type PublicBranchOperation,
	RefusedError,
	type StartOperationInput,
} from './types';

/** Generous lease — a copy-on-write reset is near-instant; this only guards crashes. */
const LEASE_MS = 5 * 60 * 1000;

function toPublicOperation(row: DbopsOperation): PublicBranchOperation {
	return {
		id: row.id,
		kind: row.kind,
		status: row.status,
		trigger: row.trigger,
		neonOpCount: row.neonOperationIds.length,
		error: row.error ?? null,
		actorEmail: row.actorEmail,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
	};
}

function isUniqueViolation(err: unknown): boolean {
	const e = err as { code?: string; cause?: { code?: string } };
	return e?.code === '23505' || e?.cause?.code === '23505';
}

function leaseUntil(): Date {
	return new Date(Date.now() + LEASE_MS);
}

export async function startOperation(
	input: StartOperationInput,
): Promise<{ operation: PublicBranchOperation; replayed: boolean }> {
	if (!neonConfigured()) throw new NotConfiguredError();

	// Idempotency replay — same key returns the original operation.
	if (input.idempotencyKey) {
		const [existing] = await db
			.select()
			.from(dbopsOperation)
			.where(eq(dbopsOperation.idempotencyKey, input.idempotencyKey))
			.limit(1);
		if (existing) return { operation: toPublicOperation(existing), replayed: true };
	}

	const targets = await resolveTargets(); // throws TargetsError if unconfigured

	// Reset-from-parent is rejected by Neon if the branch has children.
	if (await hasChildren(targets.devBranchId)) {
		throw new RefusedError('Dev branch has child branches; delete them before refreshing.');
	}

	// Insert as `running` — the active-unique index enforces one in-flight refresh.
	const id = createId.branchOperation();
	try {
		await db.insert(dbopsOperation).values({
			id,
			kind: input.kind,
			status: 'running',
			trigger: input.trigger,
			devBranchId: targets.devBranchId,
			parentBranchId: targets.parentBranchId,
			idempotencyKey: input.idempotencyKey ?? null,
			actorId: input.actorId,
			actorEmail: input.actorEmail,
			leaseExpiresAt: leaseUntil(),
		});
	} catch (err) {
		if (isUniqueViolation(err)) throw new ConflictError();
		throw err;
	}

	// Fire the Neon restore. Record op ids on success; mark failed on error.
	try {
		const { operations } = await restoreBranchFromParent(targets.devBranchId, targets.parentBranchId);
		const [updated] = await db
			.update(dbopsOperation)
			.set({
				neonOperationIds: operations.map((o) => o.id),
				neonOpStatuses: Object.fromEntries(operations.map((o) => [o.id, o.status])),
				leaseExpiresAt: leaseUntil(),
				updatedAt: new Date(),
			})
			.where(eq(dbopsOperation.id, id))
			.returning();
		return { operation: toPublicOperation(updated), replayed: false };
	} catch (err) {
		const [failed] = await db
			.update(dbopsOperation)
			.set({
				status: 'failed',
				error: { message: sanitizeError(err), at: new Date().toISOString() },
				finishedAt: new Date(),
				leaseExpiresAt: null,
				updatedAt: new Date(),
			})
			.where(eq(dbopsOperation.id, id))
			.returning();
		return { operation: toPublicOperation(failed), replayed: false };
	}
}

/** Advance an operation by polling its Neon operations. Idempotent; safe to call repeatedly. */
export async function advanceOperation(runId: string): Promise<PublicBranchOperation | null> {
	const [row] = await db.select().from(dbopsOperation).where(eq(dbopsOperation.id, runId)).limit(1);
	if (!row) return null;
	if (row.status !== 'running' && row.status !== 'queued') return toPublicOperation(row);

	// Lease lapsed → presumed crashed.
	if (row.leaseExpiresAt && row.leaseExpiresAt.getTime() < Date.now()) {
		const [failed] = await db
			.update(dbopsOperation)
			.set({
				status: 'failed',
				error: { message: 'operation lease expired', at: new Date().toISOString() },
				finishedAt: new Date(),
				leaseExpiresAt: null,
				updatedAt: new Date(),
			})
			.where(and(eq(dbopsOperation.id, runId), eq(dbopsOperation.status, 'running')))
			.returning();
		return toPublicOperation(failed ?? row);
	}

	if (row.neonOperationIds.length === 0) return toPublicOperation(row);

	try {
		const ops = await Promise.all(row.neonOperationIds.map((opId) => getOperation(opId)));
		const statuses = Object.fromEntries(ops.map((o) => [o.id, o.status]));
		const anyFailed = ops.some((o) => NEON_OP_TERMINAL_FAIL.includes(o.status));
		const allOk = ops.every((o) => o.status === NEON_OP_TERMINAL_OK);
		const guard = and(eq(dbopsOperation.id, runId), eq(dbopsOperation.status, 'running'));

		if (anyFailed) {
			const [failed] = await db
				.update(dbopsOperation)
				.set({
					status: 'failed',
					neonOpStatuses: statuses,
					error: { message: 'Neon operation failed', at: new Date().toISOString() },
					finishedAt: new Date(),
					leaseExpiresAt: null,
					updatedAt: new Date(),
				})
				.where(guard)
				.returning();
			return toPublicOperation(failed ?? row);
		}
		if (allOk) {
			const [done] = await db
				.update(dbopsOperation)
				.set({
					status: 'succeeded',
					neonOpStatuses: statuses,
					finishedAt: new Date(),
					leaseExpiresAt: null,
					updatedAt: new Date(),
				})
				.where(guard)
				.returning();
			return toPublicOperation(done ?? row);
		}
		const [still] = await db
			.update(dbopsOperation)
			.set({ neonOpStatuses: statuses, leaseExpiresAt: leaseUntil(), updatedAt: new Date() })
			.where(guard)
			.returning();
		return toPublicOperation(still ?? row);
	} catch {
		// Transient Neon error — leave running for the next poll.
		return toPublicOperation(row);
	}
}

export async function listOperations(
	limit: number,
	cursor: { createdAt: string; id: string } | null,
): Promise<PublicBranchOperation[]> {
	const rows = await db
		.select()
		.from(dbopsOperation)
		.where(
			cursor
				? or(
						lt(dbopsOperation.createdAt, new Date(cursor.createdAt)),
						and(eq(dbopsOperation.createdAt, new Date(cursor.createdAt)), lt(dbopsOperation.id, cursor.id)),
					)
				: undefined,
		)
		.orderBy(desc(dbopsOperation.createdAt), desc(dbopsOperation.id))
		.limit(limit + 1);
	return rows.map(toPublicOperation);
}

/** Best-effort cancel — marks the operation canceled and stops tracking. The Neon
 *  operation may still complete (Neon only cancels ops still scheduling). */
export async function cancelOperation(runId: string): Promise<PublicBranchOperation | null> {
	const [row] = await db.select().from(dbopsOperation).where(eq(dbopsOperation.id, runId)).limit(1);
	if (!row) return null;
	if (row.status !== 'running' && row.status !== 'queued') return toPublicOperation(row);
	const [canceled] = await db
		.update(dbopsOperation)
		.set({
			status: 'canceled',
			error: { message: 'canceled by operator', at: new Date().toISOString() },
			finishedAt: new Date(),
			leaseExpiresAt: null,
			updatedAt: new Date(),
		})
		.where(and(eq(dbopsOperation.id, runId), inArray(dbopsOperation.status, ['running', 'queued'])))
		.returning();
	return toPublicOperation(canceled ?? row);
}

/** Secondary reaper: fail operations whose lease lapsed (registered as a job). */
export async function reapExpiredOperations(): Promise<number> {
	const reaped = await db
		.update(dbopsOperation)
		.set({
			status: 'failed',
			error: { message: 'operation lease expired (reaped)', at: new Date().toISOString() },
			finishedAt: new Date(),
			leaseExpiresAt: null,
			updatedAt: new Date(),
		})
		.where(and(eq(dbopsOperation.status, 'running'), lt(dbopsOperation.leaseExpiresAt, new Date())))
		.returning({ id: dbopsOperation.id });
	return reaped.length;
}
