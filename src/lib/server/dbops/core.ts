/**
 * dbops orchestrator — the single core called by the manual form action AND the
 * scheduled job. Executor model: lazy-advance-on-poll.
 *
 * `startOperation` fires the Neon restore (fast — returns operations[]) and
 * returns immediately with status `running`. `advanceRun` (called from the
 * status endpoint on each poll, and from the scheduled job's drive loop) polls
 * the Neon operations and flips the run to a terminal state. Lazy lease-expiry
 * in `advanceRun` plus `reapExpiredRuns` recover crashed/abandoned runs.
 */
import { and, desc, eq, inArray, lt, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { createId } from '$lib/server/db/id';
import { type DbopsRun, dbopsRun } from '$lib/server/db/schema/dbops/run';
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
import { ConflictError, NotConfiguredError, RefusedError, type RunDTO, type StartOperationInput } from './types';

/** Generous lease — a copy-on-write reset is near-instant; this only guards crashes. */
const LEASE_MS = 5 * 60 * 1000;

function toDTO(row: DbopsRun): RunDTO {
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

export async function startOperation(input: StartOperationInput): Promise<{ run: RunDTO; replayed: boolean }> {
	if (!neonConfigured()) throw new NotConfiguredError();

	// Idempotency replay — same key returns the original run.
	if (input.idempotencyKey) {
		const [existing] = await db
			.select()
			.from(dbopsRun)
			.where(eq(dbopsRun.idempotencyKey, input.idempotencyKey))
			.limit(1);
		if (existing) return { run: toDTO(existing), replayed: true };
	}

	const targets = await resolveTargets(); // throws TargetsError if unconfigured

	// Reset-from-parent is rejected by Neon if the branch has children.
	if (await hasChildren(targets.devBranchId)) {
		throw new RefusedError('Dev branch has child branches; delete them before refreshing.');
	}

	// Insert as `running` — the active-unique index enforces one in-flight refresh.
	const id = createId.dbRun();
	try {
		await db.insert(dbopsRun).values({
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
			.update(dbopsRun)
			.set({
				neonOperationIds: operations.map((o) => o.id),
				neonOpStatuses: Object.fromEntries(operations.map((o) => [o.id, o.status])),
				leaseExpiresAt: leaseUntil(),
				updatedAt: new Date(),
			})
			.where(eq(dbopsRun.id, id))
			.returning();
		return { run: toDTO(updated), replayed: false };
	} catch (err) {
		const [failed] = await db
			.update(dbopsRun)
			.set({
				status: 'failed',
				error: { message: sanitizeError(err), at: new Date().toISOString() },
				finishedAt: new Date(),
				leaseExpiresAt: null,
				updatedAt: new Date(),
			})
			.where(eq(dbopsRun.id, id))
			.returning();
		return { run: toDTO(failed), replayed: false };
	}
}

/** Advance a run by polling its Neon operations. Idempotent; safe to call repeatedly. */
export async function advanceRun(runId: string): Promise<RunDTO | null> {
	const [row] = await db.select().from(dbopsRun).where(eq(dbopsRun.id, runId)).limit(1);
	if (!row) return null;
	if (row.status !== 'running' && row.status !== 'queued') return toDTO(row);

	// Lease lapsed → presumed crashed.
	if (row.leaseExpiresAt && row.leaseExpiresAt.getTime() < Date.now()) {
		const [failed] = await db
			.update(dbopsRun)
			.set({
				status: 'failed',
				error: { message: 'operation lease expired', at: new Date().toISOString() },
				finishedAt: new Date(),
				leaseExpiresAt: null,
				updatedAt: new Date(),
			})
			.where(and(eq(dbopsRun.id, runId), eq(dbopsRun.status, 'running')))
			.returning();
		return toDTO(failed ?? row);
	}

	if (row.neonOperationIds.length === 0) return toDTO(row);

	try {
		const ops = await Promise.all(row.neonOperationIds.map((opId) => getOperation(opId)));
		const statuses = Object.fromEntries(ops.map((o) => [o.id, o.status]));
		const anyFailed = ops.some((o) => NEON_OP_TERMINAL_FAIL.includes(o.status));
		const allOk = ops.every((o) => o.status === NEON_OP_TERMINAL_OK);
		const guard = and(eq(dbopsRun.id, runId), eq(dbopsRun.status, 'running'));

		if (anyFailed) {
			const [failed] = await db
				.update(dbopsRun)
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
			return toDTO(failed ?? row);
		}
		if (allOk) {
			const [done] = await db
				.update(dbopsRun)
				.set({
					status: 'succeeded',
					neonOpStatuses: statuses,
					finishedAt: new Date(),
					leaseExpiresAt: null,
					updatedAt: new Date(),
				})
				.where(guard)
				.returning();
			return toDTO(done ?? row);
		}
		const [still] = await db
			.update(dbopsRun)
			.set({ neonOpStatuses: statuses, leaseExpiresAt: leaseUntil(), updatedAt: new Date() })
			.where(guard)
			.returning();
		return toDTO(still ?? row);
	} catch {
		// Transient Neon error — leave running for the next poll.
		return toDTO(row);
	}
}

export async function getRun(runId: string): Promise<RunDTO | null> {
	return advanceRun(runId);
}

export async function listRuns(limit: number, cursor: { createdAt: string; id: string } | null): Promise<RunDTO[]> {
	const rows = await db
		.select()
		.from(dbopsRun)
		.where(
			cursor
				? or(
						lt(dbopsRun.createdAt, new Date(cursor.createdAt)),
						and(eq(dbopsRun.createdAt, new Date(cursor.createdAt)), lt(dbopsRun.id, cursor.id)),
					)
				: undefined,
		)
		.orderBy(desc(dbopsRun.createdAt), desc(dbopsRun.id))
		.limit(limit + 1);
	return rows.map(toDTO);
}

/** Best-effort cancel — marks the run canceled and stops tracking. The Neon
 *  operation may still complete (Neon only cancels ops still scheduling). */
export async function cancelRun(runId: string): Promise<RunDTO | null> {
	const [row] = await db.select().from(dbopsRun).where(eq(dbopsRun.id, runId)).limit(1);
	if (!row) return null;
	if (row.status !== 'running' && row.status !== 'queued') return toDTO(row);
	const [canceled] = await db
		.update(dbopsRun)
		.set({
			status: 'canceled',
			error: { message: 'canceled by operator', at: new Date().toISOString() },
			finishedAt: new Date(),
			leaseExpiresAt: null,
			updatedAt: new Date(),
		})
		.where(and(eq(dbopsRun.id, runId), inArray(dbopsRun.status, ['running', 'queued'])))
		.returning();
	return toDTO(canceled ?? row);
}

/** Secondary reaper: fail runs whose lease lapsed (registered as a job). */
export async function reapExpiredRuns(): Promise<number> {
	const reaped = await db
		.update(dbopsRun)
		.set({
			status: 'failed',
			error: { message: 'operation lease expired (reaped)', at: new Date().toISOString() },
			finishedAt: new Date(),
			leaseExpiresAt: null,
			updatedAt: new Date(),
		})
		.where(and(eq(dbopsRun.status, 'running'), lt(dbopsRun.leaseExpiresAt, new Date())))
		.returning({ id: dbopsRun.id });
	return reaped.length;
}
