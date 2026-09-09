/**
 * dbops core — invariants a browser test can't safely prove (they'd need a second
 * destructive reset or a concurrency race):
 *   1. the active-unique index actually blocks a 2nd in-flight refresh → ConflictError
 *   2. a terminal operation frees the lock so the next refresh can start
 *   3. idempotency replay returns the original operation without re-firing the Neon restore
 *   4. advanceOperation is idempotent — running → terminal happens exactly once
 *   5. the trimmed PublicBranchOperation never carries raw branch / op ids (Finding A regression)
 *
 * Runs against a real PGlite database — the partial-unique index IS the unit under
 * test — with the Neon Management API mocked at the `$lib/server/neon` boundary.
 */
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

let testClient: PGlite;

// Neon domain — driven per-test; core.ts imports exactly these names.
const neonConfigured = vi.fn(() => true);
const resolveTargets = vi.fn(async () => ({ devBranchId: 'br-dev', parentBranchId: 'br-prod' }));
const hasChildren = vi.fn(async (_id: string) => false);
const restoreBranchFromParent = vi.fn(async (_dev: string, _parent: string) => ({
	operations: [{ id: 'op-1', action: 'restore', status: 'running', branchId: 'br-dev' }],
}));
const getOperation = vi.fn(async (id: string) => ({ id, action: 'restore', status: 'finished', branchId: 'br-dev' }));

vi.mock('$lib/server/db', async () => {
	const { createTestDb } = await import('$lib/server/test/db');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

vi.mock('$lib/server/neon', () => ({
	neonConfigured: () => neonConfigured(),
	resolveTargets: () => resolveTargets(),
	hasChildren: (id: string) => hasChildren(id),
	restoreBranchFromParent: (a: string, b: string) => restoreBranchFromParent(a, b),
	getOperation: (id: string) => getOperation(id),
	NEON_OP_TERMINAL_OK: 'finished',
	NEON_OP_TERMINAL_FAIL: ['failed', 'cancelled'],
}));

vi.mock('$lib/server/monitoring', () => ({
	sanitizeError: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

const { db } = await import('$lib/server/db');
const { dbopsOperation } = await import('$lib/server/db/schema/dbops/operation');
const { startOperation, advanceOperation } = await import('./operations');
const { ConflictError } = await import('./types');

const INPUT = {
	kind: 'reset_from_parent' as const,
	trigger: 'manual' as const,
	actorId: 'usr_1',
	actorEmail: 'admin@example.com',
};

beforeEach(async () => {
	vi.clearAllMocks();
	neonConfigured.mockReturnValue(true);
	resolveTargets.mockResolvedValue({ devBranchId: 'br-dev', parentBranchId: 'br-prod' });
	hasChildren.mockResolvedValue(false);
	restoreBranchFromParent.mockResolvedValue({
		operations: [{ id: 'op-1', action: 'restore', status: 'running', branchId: 'br-dev' }],
	});
	getOperation.mockImplementation(async (id: string) => ({
		id,
		action: 'restore',
		status: 'finished',
		branchId: 'br-dev',
	}));
	await db.delete(dbopsOperation);
});

afterAll(async () => {
	await testClient?.close();
});

describe('startOperation — concurrency lock', () => {
	it('blocks a second in-flight refresh with ConflictError (partial-unique index)', async () => {
		const first = await startOperation(INPUT);
		expect(first.operation.status).toBe('running');
		expect(first.replayed).toBe(false);

		await expect(startOperation(INPUT)).rejects.toBeInstanceOf(ConflictError);

		// The DB index is the real guard — exactly one row may exist.
		const rows = await db.select().from(dbopsOperation);
		expect(rows).toHaveLength(1);
	});

	it('frees the lock once the prior operation reaches a terminal state', async () => {
		const first = await startOperation(INPUT);
		await advanceOperation(first.operation.id); // op-1 finished → succeeded → leaves the active set

		const second = await startOperation(INPUT);
		expect(second.operation.status).toBe('running');
		expect(second.replayed).toBe(false);
	});
});

describe('startOperation — idempotency replay', () => {
	it('replays the original operation for a repeated key, without re-firing the Neon restore', async () => {
		const key = 'idem-abc';
		const a = await startOperation({ ...INPUT, idempotencyKey: key });
		expect(a.replayed).toBe(false);
		expect(restoreBranchFromParent).toHaveBeenCalledTimes(1);

		const b = await startOperation({ ...INPUT, idempotencyKey: key });
		expect(b.replayed).toBe(true);
		expect(b.operation.id).toBe(a.operation.id);
		expect(restoreBranchFromParent).toHaveBeenCalledTimes(1); // not fired again
	});
});

describe('advanceOperation — terminal idempotency', () => {
	it('transitions running → succeeded once, then no-ops (no re-poll, finishedAt frozen)', async () => {
		const { operation } = await startOperation(INPUT);
		getOperation.mockClear();

		const first = await advanceOperation(operation.id);
		expect(first?.status).toBe('succeeded');
		expect(first?.finishedAt).not.toBeNull();
		expect(getOperation).toHaveBeenCalledTimes(1);

		const second = await advanceOperation(operation.id);
		expect(second?.status).toBe('succeeded');
		expect(second?.finishedAt).toBe(first?.finishedAt); // unchanged
		expect(getOperation).toHaveBeenCalledTimes(1); // terminal operation is not re-polled
	});

	it('marks the operation failed when a Neon operation fails', async () => {
		const { operation } = await startOperation(INPUT);
		getOperation.mockResolvedValueOnce({ id: 'op-1', action: 'restore', status: 'failed', branchId: 'br-dev' });

		const advanced = await advanceOperation(operation.id);
		expect(advanced?.status).toBe('failed');
		expect(advanced?.error?.message).toBeTruthy();
	});
});

describe('PublicBranchOperation — no identifier leak (Finding A)', () => {
	it('exposes a non-identifying op count and omits raw branch / op ids', async () => {
		const { operation } = await startOperation(INPUT);
		expect(operation.neonOpCount).toBe(1);
		expect(operation).not.toHaveProperty('devBranchId');
		expect(operation).not.toHaveProperty('parentBranchId');
		expect(operation).not.toHaveProperty('neonOperationIds');
		expect(operation).not.toHaveProperty('neonOpStatuses');
	});
});
