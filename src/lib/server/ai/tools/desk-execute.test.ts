/**
 * Tests for `executeDeskToolCall` — the one door every desk mutation goes through.
 *
 * It enforces scopes (the in-loop path is gated by which tools get assembled, so this
 * path has to gate itself or approval becomes the weaker door for the same mutation),
 * parses every payload against the tool's contract (a persisted plan is not trusted
 * either), and binds a change to the REVIEWED baseline: the version the user saw on
 * the card, never a fresh read the replay could make for itself.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** A transaction handle is the db itself here — the door only needs `transaction(fn)` to call `fn`. */
const fakeDb: Record<string, unknown> = {};
fakeDb.transaction = async (fn: (tx: unknown) => Promise<unknown>) => fn(fakeDb);
vi.mock('$lib/server/db', () => ({ db: fakeDb }));

const mockDeleteFile = vi.fn();
const mockRenameFile = vi.fn();
const mockUpdateMarkdown = vi.fn();
const mockUpdateSpreadsheet = vi.fn();
const mockCreateMarkdown = vi.fn();
const mockCreateSpreadsheet = vi.fn();
const mockLockFile = vi.fn();
const mockGetSpreadsheet = vi.fn();

vi.mock('$lib/server/db/desk/mutations', () => ({
	deleteFile: mockDeleteFile,
	renameFile: mockRenameFile,
	updateMarkdownByFileId: mockUpdateMarkdown,
	updateSpreadsheetByFileId: mockUpdateSpreadsheet,
	createMarkdownFile: mockCreateMarkdown,
	createSpreadsheetFile: mockCreateSpreadsheet,
	lockFileIfUnchanged: mockLockFile,
}));
vi.mock('$lib/server/db/desk/queries', () => ({
	getSpreadsheetByFileId: mockGetSpreadsheet,
}));

const { executeDeskToolCall, DESK_EXECUTABLE_TOOLS, TOOL_RECOVERY, TOOL_SCOPE, effectsForStep } = await import(
	'./desk-execute'
);

const USER_ID = 'usr_exec_test';
const REVIEWED_AT = '2026-09-12T08:00:00.000Z';

/** Every scope granted — the execution tests assert behaviour, not authorization. */
const ALL_SCOPES = ['desk:read', 'desk:write', 'desk:create', 'desk:delete', 'desk:ask'] as const;
const ctx = (scopes: readonly string[] = ALL_SCOPES) =>
	({ userId: USER_ID, scopes: [...scopes], actor: 'proposal-replay' }) as Parameters<typeof executeDeskToolCall>[0];

const sheetTarget = (version: number) => ({
	fileId: 'fil_abc',
	fileType: 'spreadsheet' as const,
	name: 'sheet',
	version,
	updatedAt: REVIEWED_AT,
});
const fileTarget = (fileId = 'fil_abc') => ({
	fileId,
	fileType: 'markdown' as const,
	name: 'alpha',
	version: null,
	updatedAt: REVIEWED_AT,
});

beforeEach(() => {
	vi.clearAllMocks();
	mockLockFile.mockResolvedValue({ status: 'locked', file: { id: 'fil_abc' } });
});

describe('executeDeskToolCall — the reviewed baseline', () => {
	it('CASes on the version the user reviewed, not the version it reads now', async () => {
		// Stored version moved 7 → 8 after review. The merge base is the live cells, the CAS
		// is the reviewed 7 — so the mutation's own conflict check is what refuses it.
		mockGetSpreadsheet.mockResolvedValueOnce({ spreadsheet: { cells: { A1: { v: 'kept' } }, version: 8 } });
		mockUpdateSpreadsheet.mockResolvedValueOnce({ status: 'conflict' });
		const out = await executeDeskToolCall(
			ctx(),
			'desk_update_cells',
			{ file_id: 'fil_abc', updates: [{ cell: 'B1', value: 'new' }] },
			sheetTarget(7),
		);
		expect(mockUpdateSpreadsheet).toHaveBeenCalledExactlyOnceWith(
			'fil_abc',
			USER_ID,
			{ cells: { A1: { v: 'kept' }, B1: { v: 'new' } }, expectedVersion: 7 },
			'ai',
			fakeDb,
		);
		expect(out).toMatchObject({ ok: false, kind: 'conflict', errorMessage: expect.stringContaining('reviewed') });
	});

	it('refuses an update, rename or delete that arrives without a baseline — nothing was reviewed', async () => {
		for (const [tool, args] of [
			['desk_update_cells', { file_id: 'fil_abc', updates: [{ cell: 'A1', value: 1 }] }],
			['desk_rename_file', { file_id: 'fil_abc', name: 'x' }],
			['desk_delete_file', { file_id: 'fil_abc' }],
		] as const) {
			const out = await executeDeskToolCall(ctx(), tool, args);
			expect(out).toMatchObject({ ok: false, kind: 'failed', errorMessage: expect.stringContaining('baseline') });
		}
		expect(mockUpdateSpreadsheet).not.toHaveBeenCalled();
		expect(mockRenameFile).not.toHaveBeenCalled();
		expect(mockDeleteFile).not.toHaveBeenCalled();
	});

	it('locks the file at its reviewed updatedAt before a rename or delete; a changed file is a conflict', async () => {
		mockLockFile.mockResolvedValueOnce({ status: 'changed' });
		const out = await executeDeskToolCall(ctx(), 'desk_delete_file', { file_id: 'fil_abc' }, fileTarget());
		expect(mockLockFile).toHaveBeenCalledWith(fakeDb, 'fil_abc', USER_ID, new Date(REVIEWED_AT));
		expect(out).toMatchObject({ ok: false, kind: 'conflict' });
		expect(mockDeleteFile).not.toHaveBeenCalled();
	});

	it('a create needs no baseline — there is nothing to have reviewed', async () => {
		mockCreateSpreadsheet.mockResolvedValueOnce({ file: { id: 'fil_new', name: 'Budget' } });
		const out = await executeDeskToolCall(ctx(), 'desk_create_spreadsheet', { name: 'Budget', cells: [] });
		expect(out).toMatchObject({ ok: true, output: { created: true, fileId: 'fil_new', name: 'Budget' } });
		expect(mockCreateSpreadsheet).toHaveBeenCalledWith(USER_ID, 'Budget', {}, null, null, fakeDb);
	});
});

describe('executeDeskToolCall — the argument contract', () => {
	it('lands a write on the cell it names, whatever case the model used', async () => {
		mockGetSpreadsheet.mockResolvedValueOnce({ spreadsheet: { cells: { B1: { v: 'old' } }, version: 1 } });
		mockUpdateSpreadsheet.mockResolvedValueOnce({ status: 'saved', file: { name: 'sheet' }, version: 2 });
		await executeDeskToolCall(
			ctx(),
			'desk_update_cells',
			{
				file_id: 'fil_abc',
				updates: [
					{ cell: 'b1', value: 'new' },
					{ cell: 'c1', value: null },
				],
			},
			sheetTarget(1),
		);
		expect(mockUpdateSpreadsheet).toHaveBeenCalledExactlyOnceWith(
			'fil_abc',
			USER_ID,
			{ cells: { B1: { v: 'new' } }, expectedVersion: 1 },
			'ai',
			fakeDb,
		);
	});

	it('refuses an address the sheet cannot show before any write, on update and on create', async () => {
		mockGetSpreadsheet.mockResolvedValueOnce({ spreadsheet: { cells: {}, version: 0 } });
		const update = await executeDeskToolCall(
			ctx(),
			'desk_update_cells',
			{ file_id: 'fil_abc', updates: [{ cell: 'AA1', value: 1 }] },
			sheetTarget(0),
		);
		expect(update).toMatchObject({ ok: false, errorMessage: expect.stringContaining('"AA1" is not a cell address') });
		expect(mockUpdateSpreadsheet).not.toHaveBeenCalled();

		const create = await executeDeskToolCall(ctx(), 'desk_create_spreadsheet', {
			name: 'x',
			cells: [{ cell: 'total', value: 1 }],
		});
		expect(create).toMatchObject({ ok: false, errorMessage: expect.stringContaining('"total" is not a cell address') });
		expect(mockCreateSpreadsheet).not.toHaveBeenCalled();
	});

	it('refuses empty args before touching the database — the exact plan-replay bug, now named', async () => {
		const out = await executeDeskToolCall(ctx(), 'desk_delete_file', {}, fileTarget());
		expect(mockDeleteFile).not.toHaveBeenCalled();
		expect(out).toMatchObject({ ok: false, kind: 'failed', errorMessage: expect.stringContaining('file_id') });
	});

	it("deletes the file on the caller's transaction when given a real file_id", async () => {
		mockDeleteFile.mockResolvedValueOnce({ id: 'fil_abc', name: 'alpha' });
		const out = await executeDeskToolCall(ctx(), 'desk_delete_file', { file_id: 'fil_abc' }, fileTarget());
		// Replay tags the mutation as AI-originated so the pre-image revision is attributable.
		expect(mockDeleteFile).toHaveBeenCalledWith('fil_abc', USER_ID, 'ai', fakeDb);
		expect(out).toEqual({
			ok: true,
			output: { deleted: true, fileId: 'fil_abc', name: 'alpha' },
			effects: [{ type: 'desk:refresh_explorer' }],
		});
	});

	it('passes rename args (file_id + name) through verbatim', async () => {
		mockRenameFile.mockResolvedValueOnce({ id: 'fil_x', name: 'Q3 notes' });
		const out = await executeDeskToolCall(
			ctx(),
			'desk_rename_file',
			{ file_id: 'fil_x', name: 'Q3 notes' },
			fileTarget('fil_x'),
		);
		expect(mockRenameFile).toHaveBeenCalledWith('fil_x', USER_ID, 'Q3 notes', fakeDb);
		expect(out).toMatchObject({ ok: true, output: { renamed: true, fileId: 'fil_x', name: 'Q3 notes' } });
	});

	it('rejects an unknown tool name instead of silently succeeding', async () => {
		const out = await executeDeskToolCall(ctx(), 'desk_obliterate_everything', { file_id: 'x' });
		expect(out).toEqual({
			ok: false,
			kind: 'failed',
			output: null,
			errorMessage: 'Unknown tool "desk_obliterate_everything" in proposal payload.',
		});
	});

	it('never throws — converts a mutation exception into a failed outcome', async () => {
		mockDeleteFile.mockRejectedValueOnce(new Error('DB exploded'));
		const out = await executeDeskToolCall(ctx(), 'desk_delete_file', { file_id: 'fil_abc' }, fileTarget());
		expect(out).toEqual({ ok: false, kind: 'failed', output: null, errorMessage: 'DB exploded' });
	});
});

describe('executeDeskToolCall — effects', () => {
	it('tells the desk what to reload — the gated tools never reach it, so this response must', async () => {
		mockGetSpreadsheet.mockResolvedValueOnce({ spreadsheet: { cells: {}, version: 3 } });
		mockUpdateSpreadsheet.mockResolvedValueOnce({ status: 'saved', file: { name: 'sheet' }, version: 4 });
		const update = await executeDeskToolCall(
			ctx(),
			'desk_update_cells',
			{ file_id: 'fil_abc', updates: [{ cell: 'A1', value: 1 }] },
			sheetTarget(3),
		);
		expect(update).toMatchObject({
			ok: true,
			output: { version: 4 },
			effects: [
				{ type: 'desk:refresh_file', fileId: 'fil_abc' },
				{ type: 'desk:tab_indicator', fileId: 'fil_abc', panelType: 'spreadsheet', variant: 'modified' },
			],
		});

		mockCreateSpreadsheet.mockResolvedValueOnce({ file: { id: 'fil_new', name: 'Budget' } });
		const create = await executeDeskToolCall(ctx(), 'desk_create_spreadsheet', { name: 'Budget', cells: [] });
		expect(create).toMatchObject({
			ok: true,
			effects: [
				{ type: 'desk:refresh_explorer' },
				{ type: 'desk:open_panel', panelType: 'spreadsheet', fileId: 'fil_new', label: 'Budget' },
				{ type: 'desk:tab_indicator', fileId: 'fil_new', panelType: 'spreadsheet', variant: 'created' },
			],
		});
	});

	it('derives the same effects from a persisted receipt as from the live run', async () => {
		mockCreateMarkdown.mockResolvedValueOnce({ file: { id: 'fil_doc', name: 'Notes' } });
		const live = await executeDeskToolCall(ctx(), 'desk_create_markdown', { name: 'Notes', content: '# hi' });
		expect(live.ok).toBe(true);
		if (live.ok) expect(effectsForStep('desk_create_markdown', live.output)).toEqual(live.effects);
		expect(effectsForStep('desk_update_cells', {})).toEqual([]);
	});
});

describe('executeDeskToolCall — drift guards', () => {
	it('every executable tool name is a desk mutation (sanity)', () => {
		expect(DESK_EXECUTABLE_TOOLS).toContain('desk_delete_file');
		expect(DESK_EXECUTABLE_TOOLS.every((t) => t.startsWith('desk_'))).toBe(true);
	});
	it('every executable tool declares a scope and a recovery', () => {
		expect(Object.keys(TOOL_SCOPE).sort()).toEqual([...DESK_EXECUTABLE_TOOLS].sort());
		expect(Object.keys(TOOL_RECOVERY).sort()).toEqual([...DESK_EXECUTABLE_TOOLS].sort());
	});
});

/**
 * Approval must not be a weaker door than the in-loop loop. The in-loop path
 * never assembles a tool whose scope was not granted; this path is handed a
 * persisted plan and has to refuse the same calls itself.
 */
describe('executeDeskToolCall — scope enforcement', () => {
	it('refuses a delete when desk:delete was not granted', async () => {
		const out = await executeDeskToolCall(
			ctx(['desk:read', 'desk:write']),
			'desk_delete_file',
			{ file_id: 'fil_abc' },
			fileTarget(),
		);
		expect(out.ok).toBe(false);
		expect(mockDeleteFile).not.toHaveBeenCalled();
	});

	it('refuses a write when only read was granted', async () => {
		const out = await executeDeskToolCall(
			ctx(['desk:read']),
			'desk_rename_file',
			{ file_id: 'fil_x', name: 'nope' },
			fileTarget('fil_x'),
		);
		expect(out.ok).toBe(false);
		expect(mockRenameFile).not.toHaveBeenCalled();
	});

	it('refuses everything when no scopes were granted', async () => {
		for (const tool of DESK_EXECUTABLE_TOOLS) {
			const out = await executeDeskToolCall(ctx([]), tool, {});
			expect(out.ok).toBe(false);
		}
		expect(mockDeleteFile).not.toHaveBeenCalled();
		expect(mockRenameFile).not.toHaveBeenCalled();
		expect(mockCreateMarkdown).not.toHaveBeenCalled();
	});

	it('allows the call once the matching scope is present', async () => {
		mockDeleteFile.mockResolvedValueOnce({ id: 'fil_abc', name: 'alpha' });
		const out = await executeDeskToolCall(
			ctx(['desk:delete']),
			'desk_delete_file',
			{ file_id: 'fil_abc' },
			fileTarget(),
		);
		expect(out.ok).toBe(true);
		expect(mockDeleteFile).toHaveBeenCalledOnce();
	});

	it('names the missing permission rather than failing opaquely', async () => {
		const out = await executeDeskToolCall(ctx(['desk:read']), 'desk_delete_file', { file_id: 'fil_abc' }, fileTarget());
		expect(out.ok).toBe(false);
		if (!out.ok) expect(out.errorMessage).toContain('desk:delete');
	});
});
