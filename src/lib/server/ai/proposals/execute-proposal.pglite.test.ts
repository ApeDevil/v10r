/**
 * The approval replay against a real database: a step's mutation and its receipt commit
 * together, the plan stops at the first step that is not `ok` with the earlier steps
 * kept, a step that already has a receipt is never run again, and the deterministic
 * receipt message lands in the conversation.
 */
import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { makeConversation, makeUser } from '$lib/server/test/fixtures';
import { conversation, message } from '../../db/schema/ai/conversation';
import { user } from '../../db/schema/auth/_better-auth';
import { file } from '../../db/schema/desk';

let testClient: PGlite;

vi.mock('$lib/server/db', async () => {
	const { createTestDb } = await import('$lib/server/test/db');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

/** The real receipt writer, with one seam: a test can make the next call throw. */
let failNextReceipt = false;
vi.mock('$lib/server/db/ai/proposals', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/db/ai/proposals')>();
	return {
		...actual,
		recordProposalStep: async (...args: Parameters<typeof actual.recordProposalStep>) => {
			if (failNextReceipt) {
				failNextReceipt = false;
				throw new Error('receipt write refused');
			}
			return actual.recordProposalStep(...args);
		},
	};
});

const { executeProposal, proposalOutcome, receiptText } = await import('./execute-proposal');
const { approveProposal, createProposal, getProposal, listProposalSteps, markExecuting, recordProposalStep } =
	await import('$lib/server/db/ai/proposals');
const { createSpreadsheetFile, updateSpreadsheetByFileId } = await import('$lib/server/db/desk/mutations');
const { getFile, listFiles } = await import('$lib/server/db/desk/queries');
const { readProposedTarget } = await import('../tools/proposed-target');
const { db } = await import('$lib/server/db');

const USER = makeUser({ id: 'user-replay' });
let conversationId: string;
let messageId: string;

async function claimed(payload: Parameters<typeof createProposal>[0]['payload']) {
	const proposal = await createProposal({
		conversationId,
		messageId,
		payload,
		grantedScopes: ['desk:read', 'desk:write', 'desk:create', 'desk:delete'],
	});
	await approveProposal(proposal.id, USER.id);
	const row = await markExecuting(proposal.id);
	if (!row) throw new Error('claim failed');
	return row;
}

describe('executeProposal', () => {
	beforeAll(async () => {
		await db.insert(user).values(USER);
		const conv = makeConversation({ userId: USER.id, id: crypto.randomUUID() });
		await db.insert(conversation).values(conv);
		conversationId = conv.id;
		messageId = crypto.randomUUID();
		await db.insert(message).values({ id: messageId, conversationId, role: 'assistant', content: '' });
	});
	afterAll(async () => {
		await testClient?.close();
	});

	it('runs every step, writes one receipt per step and a receipt message the model can read', async () => {
		const { file: sheet } = await createSpreadsheetFile(USER.id, 'Budget', { A1: { v: 1 } });
		const target = await readProposedTarget(USER.id, sheet.id);
		const proposal = await claimed([
			{ toolName: 'desk_create_markdown', args: { name: 'Notes', content: '# hi' }, action: 'Create "Notes"' },
			{
				toolName: 'desk_update_cells',
				args: { file_id: sheet.id, updates: [{ cell: 'A1', value: 2 }] },
				action: 'Set A1 to 2 in "Budget"',
				target: target ?? undefined,
			},
		]);

		const outcome = await executeProposal(proposal, USER.id);

		expect(outcome.status).toBe('executed');
		expect(outcome.steps.map((s) => s.kind)).toEqual(['ok', 'ok']);
		expect(outcome.effects.map((e) => e.type)).toEqual([
			'desk:refresh_explorer',
			'desk:open_panel',
			'desk:tab_indicator',
			'desk:refresh_file',
			'desk:tab_indicator',
		]);
		expect((await getProposal(proposal.id))?.status).toBe('executed');

		const receipts = await listProposalSteps(proposal.id);
		expect(receipts.map((r) => r.stepIndex)).toEqual([0, 1]);
		expect(receipts[0]?.createdFileId).toBeTruthy();

		expect(outcome.receiptMessage?.text).toContain('Ran the approved plan (2 of 2 steps).');
		expect(outcome.receiptMessage?.text).toContain('2. Set A1 to 2 in "Budget" — done (now version 1)');
		const [saved] = await db
			.select()
			.from(message)
			.where(eq(message.id, outcome.receiptMessage?.id ?? ''));
		expect(saved).toMatchObject({ role: 'assistant', conversationId, content: outcome.receiptMessage?.text });
	});

	it('stops at the first step that is not ok and keeps what ran; a conflict is named as one', async () => {
		const { file: sheet } = await createSpreadsheetFile(USER.id, 'Moving', { A1: { v: 1 } });
		const target = await readProposedTarget(USER.id, sheet.id);
		// The user saves between review and approval.
		await updateSpreadsheetByFileId(sheet.id, USER.id, { cells: { A1: { v: 9 } }, expectedVersion: 0 });

		const proposal = await claimed([
			{ toolName: 'desk_create_markdown', args: { name: 'Before', content: 'x' }, action: 'Create "Before"' },
			{
				toolName: 'desk_update_cells',
				args: { file_id: sheet.id, updates: [{ cell: 'B1', value: 'late' }] },
				action: 'Write B1',
				target: target ?? undefined,
			},
			{ toolName: 'desk_create_markdown', args: { name: 'Never', content: 'x' }, action: 'Create "Never"' },
		]);

		const outcome = await executeProposal(proposal, USER.id);

		expect(outcome.status).toBe('failed');
		expect(outcome.failureMessage).toBe('conflict');
		expect(outcome.steps.map((s) => s.kind)).toEqual(['ok', 'conflict']);
		const names = (await listFiles(USER.id)).items.map((f) => f.name);
		expect(names).toContain('Before');
		expect(names).not.toContain('Never');
		expect(outcome.receiptMessage?.text).toContain('stopped after 1 of 3 steps');
		expect(outcome.receiptMessage?.text).toContain('3. Create "Never" — not run');
		expect((await getProposal(proposal.id))?.failureMessage).toBe('conflict');
	});

	it('rolls a step back when its receipt cannot be written — no mutation without a receipt', async () => {
		const { file: sheet } = await createSpreadsheetFile(USER.id, 'Guarded', { A1: { v: 1 } });
		const target = await readProposedTarget(USER.id, sheet.id);
		const proposal = await claimed([
			{
				toolName: 'desk_rename_file',
				args: { file_id: sheet.id, name: 'Renamed' },
				action: 'Rename',
				target: target ?? undefined,
			},
		]);

		failNextReceipt = true;
		const outcome = await executeProposal(proposal, USER.id);

		expect(outcome.status).toBe('failed');
		expect(outcome.steps).toEqual([]);
		expect((await getFile(sheet.id, USER.id))?.name).toBe('Guarded');
	});

	it('never runs a step that already has a receipt — a create is not minted twice', async () => {
		const proposal = await claimed([
			{ toolName: 'desk_create_markdown', args: { name: 'Once', content: 'x' }, action: 'Create "Once"' },
		]);
		// An earlier execution ran the step and died before its terminal transition.
		await recordProposalStep(db, {
			proposalId: proposal.id,
			stepIndex: 0,
			toolName: 'desk_create_markdown',
			kind: 'ok',
			output: { created: true, fileId: 'fil_earlier', name: 'Once' },
			createdFileId: 'fil_earlier',
		});

		const outcome = await executeProposal(proposal, USER.id);

		expect(outcome.status).toBe('executed');
		expect(outcome.steps).toHaveLength(1);
		const created = await db.select().from(file).where(eq(file.name, 'Once'));
		expect(created).toHaveLength(0);
	});

	it('rebuilds the outcome of a settled proposal from its receipts', async () => {
		const proposal = await claimed([
			{ toolName: 'desk_create_markdown', args: { name: 'Settled', content: 'x' }, action: 'Create "Settled"' },
		]);
		const live = await executeProposal(proposal, USER.id);
		const later = await proposalOutcome((await getProposal(proposal.id)) ?? proposal);

		expect(later.status).toBe('executed');
		expect(later.steps).toEqual(live.steps);
		expect(later.effects).toEqual(live.effects);
		expect(later.receiptMessage).toBeNull();
	});

	it('writes the receipt text deterministically from the receipts', () => {
		const proposal = {
			payload: [
				{ toolName: 'desk_rename_file', args: {}, action: 'Rename "a" → "b"' },
				{ toolName: 'desk_delete_file', args: {}, action: 'Delete "c"' },
			],
		} as unknown as Parameters<typeof receiptText>[0];
		const text = receiptText(
			proposal,
			[{ stepIndex: 0, toolName: 'desk_rename_file', kind: 'failed', output: null, errorMessage: 'File not found.' }],
			'failed',
		);
		expect(text).toBe(
			[
				'The approved plan stopped after 0 of 2 steps; nothing was rolled back.',
				'1. Rename "a" → "b" — failed: File not found.',
				'2. Delete "c" — not run',
			].join('\n'),
		);
	});
});
