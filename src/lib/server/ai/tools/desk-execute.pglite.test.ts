/**
 * The AI write path against a real database: what `desk_update_cells` and
 * `desk_create_spreadsheet` store is what `desk_read_file` — and so the model's next
 * turn — reads back. Before the write door re-derived, a stored total kept its old value
 * after the AI rewrote one of its inputs, and the read reported it as fact.
 */
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { makeUser } from '$lib/server/test/fixtures';
import { user } from '../../db/schema/auth/_better-auth';

let testClient: PGlite;

vi.mock('$lib/server/db', async () => {
	const { createTestDb } = await import('$lib/server/test/db');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

const { executeDeskToolCall } = await import('./desk-execute');
const { createReadTools } = await import('./desk-read');
const { readProposedTarget } = await import('./proposed-target');
const { DESK_READ_MAX_CHARS } = await import('../config');
const { createMarkdownFile, createSpreadsheetFile, updateSpreadsheetByFileId } = await import(
	'$lib/server/db/desk/mutations'
);
const { getMarkdownByFileId } = await import('$lib/server/db/desk/queries');
const { db } = await import('$lib/server/db');

const USER = makeUser({ id: 'user-ai-writer' });
const ctx: Parameters<typeof executeDeskToolCall>[0] = {
	userId: USER.id,
	scopes: ['desk:write', 'desk:create'],
};
const execCtx = () => ({ toolCallId: 'tc', messages: [], abortSignal: new AbortController().signal });

/** The baseline a gated tool would have captured when the change was proposed. */
async function reviewed(fileId: string) {
	const target = await readProposedTarget(USER.id, fileId);
	if (!target) throw new Error('fixture file missing');
	return target;
}

/** The document as the model sees it: `desk_read_file`'s window from offset 0. */
async function readBackMarkdown(fileId: string): Promise<{ content: string; version: number }> {
	const out = (await createReadTools(USER.id).desk_read_file.execute?.({ file_id: fileId, offset: 0 }, execCtx())) as {
		content?: string;
		file?: { version: number };
		error?: string;
	};
	expect(out.error).toBeUndefined();
	return { content: out.content ?? '', version: out.file?.version ?? -1 };
}

/** The sheet as the model sees it: `desk_read_file`'s `A1: {json}` lines, parsed back. */
async function readBack(fileId: string): Promise<Record<string, unknown>> {
	const out = (await createReadTools(USER.id).desk_read_file.execute?.({ file_id: fileId, offset: 0 }, execCtx())) as {
		content?: string;
		error?: string;
	};
	expect(out.error).toBeUndefined();
	const cells: Record<string, unknown> = {};
	for (const line of (out.content ?? '').split('\n')) {
		const at = line.indexOf(': ');
		if (at > 0) cells[line.slice(0, at)] = JSON.parse(line.slice(at + 2));
	}
	return cells;
}

describe('AI write path stores a sheet the grid would agree with', () => {
	beforeAll(async () => {
		await db.insert(user).values(USER);
	});
	afterAll(async () => {
		await testClient?.close();
	});

	it('recomputes an existing formula when the AI writes one of its inputs', async () => {
		const { file } = await createSpreadsheetFile(USER.id, 'Budget', {
			A1: { v: 100 },
			A2: { v: 50 },
			A3: { v: 150, f: '=SUM(A1:A2)' },
		});

		const out = await executeDeskToolCall(
			ctx,
			'desk_update_cells',
			{ file_id: file.id, updates: [{ cell: 'a2', value: 75 }] },
			await reviewed(file.id),
		);
		expect(out).toMatchObject({ ok: true, output: { cellsChanged: 1, version: 1 } });

		expect(await readBack(file.id)).toEqual({ A1: { v: 100 }, A2: { v: 75 }, A3: { v: 175, f: '=SUM(A1:A2)' } });
	});

	it('stores a formula the AI writes as a formula, with its result', async () => {
		const out = await executeDeskToolCall(ctx, 'desk_create_spreadsheet', {
			name: 'Totals',
			cells: [
				{ cell: 'B1', value: 3 },
				{ cell: 'B2', value: 4 },
				{ cell: 'B3', value: '=SUM(B1:B2)' },
			],
		});
		expect(out.ok).toBe(true);
		const fileId = (out.output as { fileId: string }).fileId;

		expect((await readBack(fileId)).B3).toEqual({ v: 7, f: '=SUM(B1:B2)' });
	});

	it('refuses an address the sheet cannot show instead of reporting it saved', async () => {
		const { file } = await createSpreadsheetFile(USER.id, 'Narrow', { A1: { v: 1 } });
		const out = await executeDeskToolCall(
			ctx,
			'desk_update_cells',
			{ file_id: file.id, updates: [{ cell: 'AA1', value: 2 }] },
			await reviewed(file.id),
		);
		expect(out).toMatchObject({ ok: false, errorMessage: expect.stringContaining('"AA1" is not a cell address') });
		expect(await readBack(file.id)).toEqual({ A1: { v: 1 } });
	});

	it('refuses a cell write reviewed against a sheet the user has since edited', async () => {
		const { file } = await createSpreadsheetFile(USER.id, 'Moving', { A1: { v: 1 } });
		const target = await reviewed(file.id);
		// The user saves between review and approval.
		await updateSpreadsheetByFileId(file.id, USER.id, { cells: { A1: { v: 2 } }, expectedVersion: 0 });

		const out = await executeDeskToolCall(
			ctx,
			'desk_update_cells',
			{ file_id: file.id, updates: [{ cell: 'B1', value: 'late' }] },
			target,
		);
		expect(out).toMatchObject({ ok: false, kind: 'conflict' });
		expect(await readBack(file.id)).toEqual({ A1: { v: 2 } });
	});

	it('bumps the markdown version on an approved overwrite and refuses the next stale one', async () => {
		const { file } = await createMarkdownFile(USER.id, 'Notes', 'v0');
		const target = await reviewed(file.id);
		expect(target.version).toBe(0);

		const first = await executeDeskToolCall(ctx, 'desk_update_markdown', { file_id: file.id, content: 'v1' }, target);
		expect(first).toMatchObject({ ok: true, output: { version: 1 } });

		const stale = await executeDeskToolCall(ctx, 'desk_update_markdown', { file_id: file.id, content: 'v2' }, target);
		expect(stale).toMatchObject({ ok: false, kind: 'conflict' });
		expect((await reviewed(file.id)).version).toBe(1);
	});

	it('applies targeted markdown edits on the reviewed version and leaves the rest untouched', async () => {
		const { file } = await createMarkdownFile(USER.id, 'Notes', '# Title\n\nkeep this\n\nfix teh typo\n');
		const target = await reviewed(file.id);
		const out = await executeDeskToolCall(
			ctx,
			'desk_edit_markdown',
			{ file_id: file.id, edits: [{ find: 'teh typo', replace: 'the typo' }] },
			target,
		);
		expect(out).toMatchObject({ ok: true, output: { editsApplied: 1, version: 1 } });
		const doc = await readBackMarkdown(file.id);
		expect(doc.content).toBe('# Title\n\nkeep this\n\nfix the typo\n');

		// The same reviewed version again is a conflict — the document has moved on.
		const stale = await executeDeskToolCall(
			ctx,
			'desk_edit_markdown',
			{ file_id: file.id, edits: [{ find: 'keep this', replace: 'kept' }] },
			target,
		);
		expect(stale).toMatchObject({ ok: false, kind: 'conflict' });
	});

	it('refuses a whole-document rewrite of a document longer than one read shows', async () => {
		const long = 'y'.repeat(DESK_READ_MAX_CHARS + 1);
		const { file } = await createMarkdownFile(USER.id, 'Long', long);
		const target = await reviewed(file.id);
		const out = await executeDeskToolCall(ctx, 'desk_update_markdown', { file_id: file.id, content: 'short' }, target);
		expect(out).toMatchObject({
			ok: false,
			kind: 'failed',
			errorMessage: expect.stringContaining('desk_edit_markdown'),
		});
		expect((await getMarkdownByFileId(file.id, USER.id))?.markdown.content).toBe(long);
	});
});
