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
const { createSpreadsheetFile } = await import('$lib/server/db/desk/mutations');
const { db } = await import('$lib/server/db');

const USER = makeUser({ id: 'user-ai-writer' });
const ctx: Parameters<typeof executeDeskToolCall>[0] = {
	userId: USER.id,
	scopes: ['desk:write', 'desk:create'],
	actor: 'proposal-replay',
};
const execCtx = () => ({ toolCallId: 'tc', messages: [], abortSignal: new AbortController().signal });

/** The sheet as the model sees it: `desk_read_file`'s `A1: {json}` lines, parsed back. */
async function readBack(fileId: string): Promise<Record<string, unknown>> {
	const out = (await createReadTools(USER.id).desk_read_file.execute?.({ file_id: fileId }, execCtx())) as {
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

		const out = await executeDeskToolCall(ctx, 'desk_update_cells', {
			file_id: file.id,
			updates: [{ cell: 'a2', value: 75 }],
		});
		expect(out).toMatchObject({ ok: true, output: { cellsChanged: 1 } });

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
		const out = await executeDeskToolCall(ctx, 'desk_update_cells', {
			file_id: file.id,
			updates: [{ cell: 'AA1', value: 2 }],
		});
		expect(out).toMatchObject({ ok: false, errorMessage: expect.stringContaining('"AA1" is not a cell address') });
		expect(await readBack(file.id)).toEqual({ A1: { v: 1 } });
	});
});
