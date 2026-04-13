/**
 * Integration tests for the proposal lifecycle — state machine transitions
 * and the exactly-once execution guarantee.
 *
 * Uses the same PGlite test DB pattern as the desk mutations tests.
 */
import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
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

const { approveProposal, createProposal, getProposal, markExecuted, markExecuting, markFailed, rejectProposal } =
	await import('./proposals');
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
			payload: [{ toolName: 'desk_delete_file', args: { file_id: 'fil_1' } }],
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
			payload: [{ toolName: 't', args: {} }],
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
			payload: [{ toolName: 't', args: {} }],
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
			payload: [{ toolName: 't', args: {} }],
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

	it('transitions executing → executed with cached result', async () => {
		const proposal = await createProposal({
			conversationId,
			messageId,
			payload: [{ toolName: 'desk_rename_file', args: { file_id: 'fil_1', name: 'x' } }],
		});
		await approveProposal(proposal.id, USER_A.id);
		await markExecuting(proposal.id);

		const executed = await markExecuted(proposal.id, {
			toolCallIds: ['tcl_1'],
			results: [{ toolName: 'desk_rename_file', ok: true, output: { renamed: true } }],
		});
		expect(executed?.status).toBe('executed');
		expect(executed?.executedAt).not.toBeNull();
		expect(executed?.executionResult?.results).toHaveLength(1);

		// Cached result survives a re-read — this is the idempotency path.
		const cached = await getProposal(proposal.id);
		expect(cached?.executionResult?.results?.[0]?.ok).toBe(true);
	});

	it('transitions executing → failed and stores the failure message', async () => {
		const proposal = await createProposal({
			conversationId,
			messageId,
			payload: [{ toolName: 't', args: {} }],
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
			payload: [{ toolName: 't', args: {} }],
		});
		// Skip approved → executing entirely — invalid path.
		const result = await markExecuted(proposal.id, { toolCallIds: [], results: [] });
		expect(result).toBeNull();

		const current = await db.select().from(agentProposal).where(eq(agentProposal.id, proposal.id));
		expect(current[0]?.status).toBe('pending');
	});
});
