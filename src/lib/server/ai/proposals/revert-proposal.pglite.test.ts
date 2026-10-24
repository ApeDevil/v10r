/**
 * The undo of an approved plan against a real database: every kind of step is put back,
 * a file the user touched after the plan is left alone and named as a conflict, the undo
 * runs once however often it is asked for, and the receipts and message say what happened.
 */
import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { makeConversation, makeUser } from '#lib/server/test/fixtures.ts';
import { conversation, message } from '../../db/schema/ai/conversation';
import { agentProposal } from '../../db/schema/ai/proposal';
import { user } from '../../db/schema/auth/_better-auth';

let testClient: PGlite;

vi.mock('#lib/server/db/index.ts', async () => {
	const { createTestDb } = await import('#lib/server/test/db.ts');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

const { executeProposal } = await import('./execute-proposal');
const { revertProposal, seedFileStates } = await import('./revert-proposal');
const {
	approveProposal,
	claimRevert,
	createProposal,
	getProposal,
	listRevertSteps,
	lockReverting,
	markExecuting,
	markRevertInterruptedIfStale,
	recordProposalStep,
} = await import('#lib/server/db/ai/proposals.ts');
const { createMarkdownFile, createSpreadsheetFile, renameFile, updateSpreadsheetByFileId } = await import(
	'#lib/server/db/desk/mutations.ts'
);
const { getFile, getMarkdownByFileId, getSpreadsheetByFileId } = await import('#lib/server/db/desk/queries.ts');
const { readProposedTarget } = await import('../tools/proposed-target');
const { db } = await import('#lib/server/db/index.ts');

const USER = makeUser({ id: 'user-revert' });
const OTHER = makeUser({ id: 'user-revert-other', email: 'other-revert@example.com' });
let conversationId: string;
let messageId: string;

type Payload = Parameters<typeof createProposal>[0]['payload'];

/** Propose, approve, execute — the state the Undo button is offered in. */
async function ran(payload: Payload) {
	const proposal = await createProposal({
		conversationId,
		messageId,
		payload,
		grantedScopes: ['desk:read', 'desk:write', 'desk:create', 'desk:delete'],
	});
	await approveProposal(proposal.id, USER.id);
	const claimed = await markExecuting(proposal.id);
	if (!claimed) throw new Error('claim failed');
	const outcome = await executeProposal(claimed, USER.id);
	const row = await getProposal(proposal.id);
	if (!row) throw new Error('proposal vanished');
	return { outcome, row };
}

async function target(fileId: string) {
	return (await readProposedTarget(USER.id, fileId)) ?? undefined;
}

describe('revertProposal', () => {
	beforeAll(async () => {
		await db.insert(user).values([USER, OTHER]);
		const conv = makeConversation({ userId: USER.id, id: crypto.randomUUID() });
		await db.insert(conversation).values(conv);
		conversationId = conv.id;
		messageId = crypto.randomUUID();
		await db.insert(message).values({ id: messageId, conversationId, role: 'assistant', content: '' });
	});
	afterAll(async () => {
		await testClient?.close();
	});

	it('puts back an edit, a rename, a delete and a create — and says so', async () => {
		const { file: sheet } = await createSpreadsheetFile(USER.id, 'Budget', { A1: { v: 1 } });
		const { file: doc } = await createMarkdownFile(USER.id, 'Notes', '# keep');
		const { file: trash } = await createMarkdownFile(USER.id, 'Old', 'old');
		const { outcome, row } = await ran([
			{
				toolName: 'desk_update_cells',
				args: { file_id: sheet.id, updates: [{ cell: 'A1', value: 2 }] },
				action: 'Set A1',
				target: await target(sheet.id),
			},
			{
				toolName: 'desk_rename_file',
				args: { file_id: doc.id, name: 'Renamed' },
				action: 'Rename Notes',
				target: await target(doc.id),
			},
			{
				toolName: 'desk_delete_file',
				args: { file_id: trash.id },
				action: 'Delete Old',
				target: await target(trash.id),
			},
			{ toolName: 'desk_create_markdown', args: { name: 'Fresh', content: 'x' }, action: 'Create Fresh' },
		]);
		expect(outcome.status).toBe('executed');
		const createdId = String(outcome.steps[3]?.output?.fileId);

		const undone = await revertProposal(row, USER.id);

		expect(undone?.revert?.status).toBe('reverted');
		expect(undone?.revert?.steps.map((s) => [s.stepIndex, s.kind])).toEqual([
			[0, 'ok'],
			[1, 'ok'],
			[2, 'ok'],
			[3, 'ok'],
		]);
		expect((await getSpreadsheetByFileId(sheet.id, USER.id))?.spreadsheet.cells.A1?.v).toBe(1);
		expect((await getFile(doc.id, USER.id))?.name).toBe('Notes');
		expect(await getFile(trash.id, USER.id)).not.toBeNull();
		expect((await getMarkdownByFileId(trash.id, USER.id))?.markdown.content).toBe('old');
		expect(await getFile(createdId, USER.id)).toBeNull();
		expect(undone?.effects.map((e) => e.type)).toContain('desk:refresh_file');
		expect(undone?.receiptMessage?.text).toContain('Undid the plan (4 of 4 steps).');
		const [saved] = await db
			.select()
			.from(message)
			.where(eq(message.id, undone?.receiptMessage?.id ?? ''));
		expect(saved?.role).toBe('assistant');
	});

	// The undo is a compare-and-swap against what the plan left behind: work the user did
	// afterwards is never overwritten, and the conflict is reported, not hidden.
	it('leaves a file the user edited after the plan alone and reports the conflict', async () => {
		const { file: sheet } = await createSpreadsheetFile(USER.id, 'Shared', { A1: { v: 1 } });
		const { file: doc } = await createMarkdownFile(USER.id, 'Other', 'x');
		const { row } = await ran([
			{
				toolName: 'desk_update_cells',
				args: { file_id: sheet.id, updates: [{ cell: 'A1', value: 2 }] },
				action: 'Set A1',
				target: await target(sheet.id),
			},
			{
				toolName: 'desk_rename_file',
				args: { file_id: doc.id, name: 'Other renamed' },
				action: 'Rename Other',
				target: await target(doc.id),
			},
		]);
		await updateSpreadsheetByFileId(sheet.id, USER.id, { cells: { A1: { v: 'mine' } }, expectedVersion: 1 });

		const undone = await revertProposal(row, USER.id);

		expect(undone?.revert?.status).toBe('revert_failed');
		expect(undone?.revert?.steps.find((s) => s.stepIndex === 0)?.kind).toBe('conflict');
		expect(undone?.revert?.steps.find((s) => s.stepIndex === 1)?.kind).toBe('ok');
		expect((await getSpreadsheetByFileId(sheet.id, USER.id))?.spreadsheet.cells.A1?.v).toBe('mine');
		expect((await getFile(doc.id, USER.id))?.name).toBe('Other');
		expect(undone?.receiptMessage?.text).toContain('not undone: The file changed after the plan ran');
	});

	it('undoes a plan once however often it is asked', async () => {
		const { row } = await ran([
			{ toolName: 'desk_create_markdown', args: { name: 'Twice?', content: 'x' }, action: 'Create Twice?' },
		]);

		const first = await revertProposal(row, USER.id);
		const second = await revertProposal(row, USER.id);

		expect(first?.revert?.status).toBe('reverted');
		expect(second).toBeNull();
		expect(await listRevertSteps(row.id)).toHaveLength(1);
	});

	it('refuses to undo a plan that never ran', async () => {
		const proposal = await createProposal({
			conversationId,
			messageId,
			payload: [{ toolName: 'desk_create_markdown', args: { name: 'Never', content: 'x' }, action: 'Create Never' }],
		});

		expect(await revertProposal(proposal, USER.id)).toBeNull();
		expect((await getProposal(proposal.id))?.revertStatus).toBeNull();
	});

	// The one undo a plan has belongs to the owner of its conversation, whichever door calls.
	it('refuses another user’s undo without spending the owner’s', async () => {
		const { file: sheet } = await createSpreadsheetFile(USER.id, 'Private', { A1: { v: 1 } });
		const { row } = await ran([
			{
				toolName: 'desk_update_cells',
				args: { file_id: sheet.id, updates: [{ cell: 'A1', value: 2 }] },
				action: 'Set A1',
				target: await target(sheet.id),
			},
		]);

		expect(await revertProposal(row, OTHER.id)).toBeNull();
		expect((await getProposal(row.id))?.revertStatus).toBeNull();
		expect((await getSpreadsheetByFileId(sheet.id, USER.id))?.spreadsheet.cells.A1?.v).toBe(2);

		expect((await revertProposal(row, USER.id))?.revert?.status).toBe('reverted');
		expect((await getSpreadsheetByFileId(sheet.id, USER.id))?.spreadsheet.cells.A1?.v).toBe(1);
	});

	// A plan that ran before recovery points were recorded would "succeed" while undoing nothing.
	it('refuses a plan whose steps recorded no recovery point', async () => {
		const proposal = await createProposal({ conversationId, messageId, payload: [] });
		await db.update(agentProposal).set({ status: 'executed' }).where(eq(agentProposal.id, proposal.id));
		await recordProposalStep(db, {
			proposalId: proposal.id,
			stepIndex: 0,
			toolName: 'desk_rename_file',
			kind: 'ok',
			output: {},
		});
		const row = await getProposal(proposal.id);
		if (!row) throw new Error('missing');

		expect(await revertProposal(row, USER.id)).toBeNull();
		expect((await getProposal(row.id))?.revertStatus).toBeNull();
	});

	// A forward plan cannot edit one file twice (each step is checked against the state the user
	// reviewed), so the chain is exercised with receipts written directly: an edit, then a rename
	// of the same file. Without the chain, the edit's undo would conflict with the rename's undo.
	it('chains expectations per file — two steps on one file revert cleanly', async () => {
		const { file: sheet } = await createSpreadsheetFile(USER.id, 'Twice', { A1: { v: 'orig' } });
		const edited = await updateSpreadsheetByFileId(
			sheet.id,
			USER.id,
			{ cells: { A1: { v: 'edit' } }, expectedVersion: 0 },
			'ai',
		);
		if (!edited || edited.status !== 'saved') throw new Error('edit failed');
		const renamed = await renameFile(sheet.id, USER.id, 'Twice renamed');
		if (!renamed) throw new Error('rename failed');
		const proposal = await createProposal({ conversationId, messageId, payload: [] });
		await db.update(agentProposal).set({ status: 'executed' }).where(eq(agentProposal.id, proposal.id));
		await recordProposalStep(db, {
			proposalId: proposal.id,
			stepIndex: 0,
			toolName: 'desk_update_cells',
			kind: 'ok',
			output: {},
			recovery: {
				kind: 'revision',
				fileId: sheet.id,
				fileType: 'spreadsheet',
				revisionId: edited.revisionId,
				version: edited.version,
				fileUpdatedAt: edited.file.updatedAt.toISOString(),
			},
		});
		await recordProposalStep(db, {
			proposalId: proposal.id,
			stepIndex: 1,
			toolName: 'desk_rename_file',
			kind: 'ok',
			output: {},
			recovery: {
				kind: 'rename_back',
				fileId: sheet.id,
				previousName: 'Twice',
				fileUpdatedAt: renamed.updatedAt.toISOString(),
			},
		});
		const row = await getProposal(proposal.id);
		if (!row) throw new Error('missing');

		const undone = await revertProposal(row, USER.id);

		expect(undone?.revert?.status).toBe('reverted');
		expect((await getFile(sheet.id, USER.id))?.name).toBe('Twice');
		expect((await getSpreadsheetByFileId(sheet.id, USER.id))?.spreadsheet.cells.A1?.v).toBe('orig');
	});

	it('fences a revert it no longer owns, and heals one that outlived its lease', async () => {
		const { row } = await ran([
			{ toolName: 'desk_create_markdown', args: { name: 'Fence', content: 'x' }, action: 'Create Fence' },
		]);
		expect(await lockReverting(db, row.id)).toBe(false);
		expect(await claimRevert(row.id, USER.id)).not.toBeNull();
		expect(await lockReverting(db, row.id)).toBe(true);

		// The process died mid-undo: past the lease, the next status read heals it.
		await db
			.update(agentProposal)
			.set({ updatedAt: new Date(Date.now() - 60_000) })
			.where(eq(agentProposal.id, row.id));
		expect((await markRevertInterruptedIfStale(row.id, 1_000))?.revertStatus).toBe('revert_failed');
		expect(await lockReverting(db, row.id)).toBe(false);
	});
});

describe('seedFileStates', () => {
	// A plan that touches one file twice must not conflict with its own undo: the later step
	// sets the timestamp the first undo checks, the last CONTENT step sets the version.
	it('takes updatedAt from the last step and the version from the last content step', () => {
		const states = seedFileStates([
			{
				kind: 'revision',
				fileId: 'f',
				fileType: 'markdown',
				revisionId: 'r1',
				version: 4,
				fileUpdatedAt: '2026-10-10T10:00:00.000Z',
			},
			{ kind: 'rename_back', fileId: 'f', previousName: 'a', fileUpdatedAt: '2026-10-10T10:00:05.000Z' },
		]);
		expect(states.get('f')).toEqual({ updatedAt: new Date('2026-10-10T10:00:05.000Z'), version: 4 });
	});
});
