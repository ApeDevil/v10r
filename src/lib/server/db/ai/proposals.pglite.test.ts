/**
 * Integration tests for the proposal lifecycle — state machine transitions
 * and the exactly-once execution guarantee.
 *
 * Uses the same PGlite test DB pattern as the desk mutations tests.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeConversation, makeUser } from '$lib/server/test/fixtures';
import { conversation, message } from '../schema/ai/conversation';
import { agentProposal } from '../schema/ai/proposal';
import { user } from '../schema/auth/_better-auth';

let testClient: PGlite;

vi.mock('$lib/server/db', async () => {
	const { createTestDb } = await import('$lib/server/test/db');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

const {
	approveProposal,
	createProposal,
	getProposal,
	getProposalWithExpiry,
	listProposalSteps,
	markExecuted,
	markExecuting,
	markExpiredIfPending,
	markFailed,
	markInterruptedIfStale,
	recordProposalStep,
	rejectProposal,
} = await import('./proposals');
const { db } = await import('$lib/server/db');

const USER_A = makeUser({ id: 'prop-user-a' });
let conversationId: string;
let messageId: string;

describe('proposal lifecycle', () => {
	beforeAll(async () => {
		await db.insert(user).values(USER_A);
		const conv = makeConversation({ userId: USER_A.id, id: crypto.randomUUID() });
		await db.insert(conversation).values(conv);
		conversationId = conv.id;
		messageId = crypto.randomUUID();
		await db.insert(message).values({
			id: messageId,
			conversationId,
			role: 'assistant',
			content: '',
			createdAt: new Date(),
		});
	});

	afterAll(async () => {
		await testClient?.close();
	});

	beforeEach(async () => {
		await db.delete(agentProposal);
	});

	it('creates a pending proposal with payload and rationale', async () => {
		const proposal = await createProposal({
			conversationId,
			messageId,
			riskTier: 'high',
			payload: [{ toolName: 'desk_delete_file', args: { file_id: 'fil_1' }, action: 'step' }],
			rationale: 'Delete stale drafts',
		});
		expect(proposal.id).toMatch(/^prp_/);
		expect(proposal.status).toBe('pending');
		expect(proposal.riskTier).toBe('high');
		expect(proposal.rationale).toBe('Delete stale drafts');
	});

	it('transitions pending → approved only once', async () => {
		const proposal = await createProposal({
			conversationId,
			messageId,
			payload: [{ toolName: 't', args: {}, action: 'step' }],
		});
		const first = await approveProposal(proposal.id, USER_A.id);
		expect(first?.status).toBe('approved');
		expect(first?.approvedBy).toBe(USER_A.id);

		// Second approval is illegal — proposal is no longer in `pending`.
		const second = await approveProposal(proposal.id, USER_A.id);
		expect(second).toBeNull();
	});

	it('transitions pending → rejected and blocks later approval', async () => {
		const proposal = await createProposal({
			conversationId,
			messageId,
			payload: [{ toolName: 't', args: {}, action: 'step' }],
		});
		const rejected = await rejectProposal(proposal.id, 'user_said_no');
		expect(rejected?.status).toBe('rejected');
		expect(rejected?.rejectedReason).toBe('user_said_no');

		const lateApproval = await approveProposal(proposal.id, USER_A.id);
		expect(lateApproval).toBeNull();
	});

	it('enforces exactly-once execution via the state machine', async () => {
		const proposal = await createProposal({
			conversationId,
			messageId,
			payload: [{ toolName: 't', args: {}, action: 'step' }],
		});
		await approveProposal(proposal.id, USER_A.id);

		const firstClaim = await markExecuting(proposal.id);
		expect(firstClaim?.status).toBe('executing');

		// A concurrent approve would race here. Simulate the losing side:
		// another markExecuting call finds no row in `approved` state and
		// returns null — the caller must then read the existing row.
		const secondClaim = await markExecuting(proposal.id);
		expect(secondClaim).toBeNull();

		const current = await getProposal(proposal.id);
		expect(current?.status).toBe('executing');
	});

	it('transitions executing → executed; what ran is the step receipts', async () => {
		const proposal = await createProposal({
			conversationId,
			messageId,
			payload: [{ toolName: 'desk_rename_file', args: { file_id: 'fil_1', name: 'x' }, action: 'step' }],
		});
		await approveProposal(proposal.id, USER_A.id);
		await markExecuting(proposal.id);
		await recordProposalStep(db, {
			proposalId: proposal.id,
			stepIndex: 0,
			toolName: 'desk_rename_file',
			kind: 'ok',
			output: { renamed: true },
		});

		const executed = await markExecuted(proposal.id);
		expect(executed?.status).toBe('executed');
		expect(executed?.executedAt).not.toBeNull();

		// The receipts survive a re-read — this is the idempotency path.
		const steps = await listProposalSteps(proposal.id);
		expect(steps).toHaveLength(1);
		expect(steps[0]).toMatchObject({ stepIndex: 0, kind: 'ok', output: { renamed: true } });
	});

	it('refuses a second receipt for the same step — a step executes at most once', async () => {
		const proposal = await createProposal({
			conversationId,
			messageId,
			payload: [{ toolName: 'desk_rename_file', args: { file_id: 'fil_1', name: 'x' }, action: 'step' }],
		});
		await approveProposal(proposal.id, USER_A.id);
		await markExecuting(proposal.id);
		const receipt = {
			proposalId: proposal.id,
			stepIndex: 0,
			toolName: 'desk_rename_file',
			kind: 'ok' as const,
			output: {},
		};
		await recordProposalStep(db, receipt);
		await expect(recordProposalStep(db, receipt)).rejects.toThrow();
		expect(await listProposalSteps(proposal.id)).toHaveLength(1);
	});

	it('heals an executing row that outlived its lease into failed(interrupted), receipts intact', async () => {
		const proposal = await createProposal({
			conversationId,
			messageId,
			payload: [
				{ toolName: 'desk_rename_file', args: { file_id: 'fil_1', name: 'x' }, action: 'one' },
				{ toolName: 'desk_delete_file', args: { file_id: 'fil_2' }, action: 'two' },
			],
		});
		await approveProposal(proposal.id, USER_A.id);
		await markExecuting(proposal.id);
		await recordProposalStep(db, {
			proposalId: proposal.id,
			stepIndex: 0,
			toolName: 'desk_rename_file',
			kind: 'ok',
			output: {},
		});

		// Fresh heartbeat: not stale, nothing happens.
		expect(await markInterruptedIfStale(proposal.id)).toBeNull();
		// A lease of zero: the row is stale the moment it is read.
		const healed = await markInterruptedIfStale(proposal.id, 0);
		expect(healed).toMatchObject({ status: 'failed', failureMessage: 'interrupted' });
		expect(await listProposalSteps(proposal.id)).toHaveLength(1);
	});

	it('transitions executing → failed and stores the failure message', async () => {
		const proposal = await createProposal({
			conversationId,
			messageId,
			payload: [{ toolName: 't', args: {}, action: 'step' }],
		});
		await approveProposal(proposal.id, USER_A.id);
		await markExecuting(proposal.id);

		const failed = await markFailed(proposal.id, 'DB connection lost');
		expect(failed?.status).toBe('failed');
		expect(failed?.failureMessage).toBe('DB connection lost');
	});

	it('ignores illegal transitions (markExecuted on pending)', async () => {
		const proposal = await createProposal({
			conversationId,
			messageId,
			payload: [{ toolName: 't', args: {}, action: 'step' }],
		});
		// Skip approved → executing entirely — invalid path.
		const result = await markExecuted(proposal.id);
		expect(result).toBeNull();

		const current = await db.select().from(agentProposal).where(eq(agentProposal.id, proposal.id));
		expect(current[0]?.status).toBe('pending');
	});

	/**
	 * The 15-minute consent window, which until now was documented but never enforced.
	 *
	 * These assert against the domain functions DIRECTLY, not through the route. That
	 * is the whole point: a route-level `if (proposal.expiresAt < new Date())` check
	 * would satisfy an API-level test while leaving `approveProposal` callable without
	 * a time bound from anywhere else, and would carry a TOCTOU window besides. Only a
	 * predicate inside the granting statement passes the tests below.
	 */
	describe('proposal expiry', () => {
		const EXPIRED = -60_000; // a minute in the past — unambiguous, unlike a 1ms margin

		beforeEach(async () => {
			await db.delete(agentProposal);
		});

		it('the PGlite clock agrees with the host clock (assumption under every test here)', async () => {
			const before = Date.now();
			// `db.execute` yields a bare array on pglite and `{ rows }` on
			// neon-serverless — this suite runs the former, but read defensively.
			const result: unknown = await db.execute(sql`select now() as n`);
			const rows = (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as Array<{
				n: Date | string;
			}>;
			const now = rows[0]?.n;
			expect(now).toBeDefined();
			expect(Math.abs(new Date(now as Date | string).getTime() - before)).toBeLessThan(5_000);
		});

		it('refuses to approve a proposal whose window has closed', async () => {
			const proposal = await createProposal({
				conversationId,
				messageId,
				payload: [{ toolName: 'desk_delete_file', args: { file_id: 'fil_1' }, action: 'step' }],
				expiresInMs: EXPIRED,
			});
			expect(await approveProposal(proposal.id, USER_A.id)).toBeNull();
		});

		it('leaves an expired proposal completely untouched when approval is refused', async () => {
			const proposal = await createProposal({
				conversationId,
				messageId,
				payload: [{ toolName: 'desk_delete_file', args: { file_id: 'fil_1' }, action: 'step' }],
				expiresInMs: EXPIRED,
			});
			await approveProposal(proposal.id, USER_A.id);

			// No partial write: refusing must not stamp an approver on the row.
			const after = await getProposal(proposal.id);
			expect(after?.status).toBe('pending');
			expect(after?.approvedBy).toBeNull();
			expect(after?.approvedAt).toBeNull();
		});

		it('refuses to execute a proposal that expired after it was approved', async () => {
			// The gap `markExecuting` exists to close: approved inside the window,
			// claimed long after it. Only reachable by ageing the row directly —
			// the public API cannot produce an approved-and-expired proposal.
			const proposal = await createProposal({
				conversationId,
				messageId,
				payload: [{ toolName: 't', args: {}, action: 'step' }],
				expiresInMs: 60_000,
			});
			await approveProposal(proposal.id, USER_A.id);
			await db
				.update(agentProposal)
				.set({ expiresAt: new Date(Date.now() + EXPIRED) })
				.where(eq(agentProposal.id, proposal.id));

			expect(await markExecuting(proposal.id)).toBeNull();
			expect((await getProposal(proposal.id))?.status).toBe('approved');
		});

		it('still approves a proposal comfortably inside its window', async () => {
			const proposal = await createProposal({
				conversationId,
				messageId,
				payload: [{ toolName: 't', args: {}, action: 'step' }],
				expiresInMs: 15 * 60 * 1000,
			});
			expect((await approveProposal(proposal.id, USER_A.id))?.status).toBe('approved');
			expect((await markExecuting(proposal.id))?.status).toBe('executing');
		});

		it('reports expiry from the database clock so a caller can pick the right error', async () => {
			const stale = await createProposal({
				conversationId,
				messageId,
				payload: [{ toolName: 't', args: {}, action: 'step' }],
				expiresInMs: EXPIRED,
			});
			const fresh = await createProposal({
				conversationId,
				messageId,
				payload: [{ toolName: 't', args: {}, action: 'step' }],
				expiresInMs: 60_000,
			});
			expect((await getProposalWithExpiry(stale.id))?.isExpired).toBe(true);
			expect((await getProposalWithExpiry(fresh.id))?.isExpired).toBe(false);
			expect(await getProposalWithExpiry('prp_nonexistent')).toBeNull();
		});

		it('self-heals an expired pending row to `expired`, and touches nothing else', async () => {
			const stale = await createProposal({
				conversationId,
				messageId,
				payload: [{ toolName: 't', args: {}, action: 'step' }],
				expiresInMs: EXPIRED,
			});
			expect((await markExpiredIfPending(stale.id))?.status).toBe('expired');
			// Idempotent: the row is no longer `pending`, so a second call is a no-op.
			expect(await markExpiredIfPending(stale.id)).toBeNull();

			const live = await createProposal({
				conversationId,
				messageId,
				payload: [{ toolName: 't', args: {}, action: 'step' }],
				expiresInMs: 60_000,
			});
			expect(await markExpiredIfPending(live.id)).toBeNull();
			expect((await getProposal(live.id))?.status).toBe('pending');
		});

		/**
		 * Source-shape assertion, and the reason it has to exist: PGlite runs
		 * in-process and shares the host clock, so a DB-clock predicate and an
		 * app-clock one are behaviourally identical here. The distinction only
		 * bites against Neon, where the app server is a different machine with
		 * its own NTP drift — no behavioural test in this suite can defend that
		 * choice, so pin the text instead of pretending it is covered.
		 *
		 * HONEST LIMIT: this proves the predicate is written against `now()`. It
		 * does not prove the clock is remote.
		 */
		it('bounds expiry with the database clock in both granting statements', () => {
			const source = readFileSync(join(process.cwd(), 'src/lib/server/db/ai/proposals.ts'), 'utf8')
				.replace(/\/\*[\s\S]*?\*\//g, '')
				.replace(/^\s*\/\/.*$/gm, '');
			// One shared helper...
			expect(source.match(/gt\(agentProposal\.expiresAt,\s*sql`now\(\)`\)/g) ?? []).toHaveLength(1);
			// ...applied to both statements that grant authority.
			expect(source.match(/notExpired\(\)/g) ?? []).toHaveLength(2);
			// And never the app clock.
			expect(source).not.toMatch(/(lt|gt)\(\s*agentProposal\.expiresAt\s*,\s*new Date\(/);
		});
	});
});
