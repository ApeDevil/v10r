/**
 * Tests for `executeDeskToolCall` — the proposal-approval replay door.
 *
 * It also enforces scopes: the in-loop path is gated by which tools get
 * assembled, so this path has to gate itself or approval becomes the weaker
 * door for the same mutation.
 *
 * Regression guard for the plan-replay arg bug: a plan step persisted with
 * empty args (`{}`) must NOT silently no-op — it has to surface "File not
 * found" so the proposal is marked failed instead of faking success. And real
 * args must reach the desk-domain mutation verbatim so an approved plan
 * actually executes deterministically.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({ db: {} }));

const mockDeleteFile = vi.fn();
const mockRenameFile = vi.fn();
const mockUpdateMarkdown = vi.fn();
const mockUpdateSpreadsheet = vi.fn();
const mockCreateMarkdown = vi.fn();
const mockCreateSpreadsheet = vi.fn();
const mockGetSpreadsheet = vi.fn();

vi.mock('$lib/server/db/desk/mutations', () => ({
	deleteFile: mockDeleteFile,
	renameFile: mockRenameFile,
	updateMarkdownByFileId: mockUpdateMarkdown,
	updateSpreadsheetByFileId: mockUpdateSpreadsheet,
	createMarkdownFile: mockCreateMarkdown,
	createSpreadsheetFile: mockCreateSpreadsheet,
}));
vi.mock('$lib/server/db/desk/queries', () => ({
	getSpreadsheetByFileId: mockGetSpreadsheet,
}));

const { executeDeskToolCall, DESK_EXECUTABLE_TOOLS, TOOL_SCOPE } = await import('./desk-execute');

const USER_ID = 'usr_exec_test';

/** Every scope granted — the existing tests assert execution, not authorization. */
const ALL_SCOPES = ['desk:read', 'desk:write', 'desk:create', 'desk:delete', 'desk:ask'] as const;
const ctx = (scopes: readonly string[] = ALL_SCOPES) =>
	({ userId: USER_ID, scopes: [...scopes], actor: 'proposal-replay' }) as Parameters<typeof executeDeskToolCall>[0];

beforeEach(() => {
	vi.clearAllMocks();
});

describe('executeDeskToolCall — replay arg contract', () => {
	it('passes the read version to AI saves and reports conflicts without retrying stale cells', async () => {
		mockGetSpreadsheet.mockResolvedValueOnce({ spreadsheet: { cells: { A1: { v: 'kept' } }, version: 7 } });
		mockUpdateSpreadsheet.mockResolvedValueOnce({ status: 'conflict' });
		const out = await executeDeskToolCall(ctx(), 'desk_update_cells', {
			file_id: 'fil_abc',
			updates: [{ cell: 'B1', value: 'new' }],
		});
		expect(mockUpdateSpreadsheet).toHaveBeenCalledExactlyOnceWith(
			'fil_abc',
			USER_ID,
			{
				cells: { A1: { v: 'kept' }, B1: { v: 'new' } },
				expectedVersion: 7,
			},
			'ai',
		);
		expect(out).toMatchObject({ ok: false, errorMessage: expect.stringContaining('changed') });
	});
	it('lands a write on the cell it names, whatever case the model used', async () => {
		mockGetSpreadsheet.mockResolvedValueOnce({ spreadsheet: { cells: { B1: { v: 'old' } }, version: 1 } });
		mockUpdateSpreadsheet.mockResolvedValueOnce({ status: 'saved', file: { name: 'sheet' } });
		await executeDeskToolCall(ctx(), 'desk_update_cells', {
			file_id: 'fil_abc',
			updates: [
				{ cell: 'b1', value: 'new' },
				{ cell: 'c1', value: null },
			],
		});
		expect(mockUpdateSpreadsheet).toHaveBeenCalledExactlyOnceWith(
			'fil_abc',
			USER_ID,
			{ cells: { B1: { v: 'new' } }, expectedVersion: 1 },
			'ai',
		);
	});

	it('refuses an address the sheet cannot show before any write, on update and on create', async () => {
		mockGetSpreadsheet.mockResolvedValueOnce({ spreadsheet: { cells: {}, version: 0 } });
		const update = await executeDeskToolCall(ctx(), 'desk_update_cells', {
			file_id: 'fil_abc',
			updates: [{ cell: 'AA1', value: 1 }],
		});
		expect(update).toMatchObject({ ok: false, errorMessage: expect.stringContaining('"AA1" is not a cell address') });
		expect(mockUpdateSpreadsheet).not.toHaveBeenCalled();

		const create = await executeDeskToolCall(ctx(), 'desk_create_spreadsheet', {
			name: 'x',
			cells: [{ cell: 'total', value: 1 }],
		});
		expect(create).toMatchObject({ ok: false, errorMessage: expect.stringContaining('"total" is not a cell address') });
		expect(mockCreateSpreadsheet).not.toHaveBeenCalled();
	});

	it('deletes the file when given a real file_id (args reach the mutation verbatim)', async () => {
		mockDeleteFile.mockResolvedValueOnce({ id: 'fil_abc', name: 'alpha' });
		const out = await executeDeskToolCall(ctx(), 'desk_delete_file', { file_id: 'fil_abc' });
		// Replay tags the mutation as AI-originated so the pre-image revision is attributable.
		expect(mockDeleteFile).toHaveBeenCalledWith('fil_abc', USER_ID, 'ai');
		expect(out).toEqual({
			ok: true,
			output: { deleted: true, fileId: 'fil_abc', name: 'alpha' },
			effects: [{ type: 'desk:refresh_explorer' }],
		});
	});

	it('tells the desk what to reload — the gated tools never reach it, so this response must', async () => {
		mockGetSpreadsheet.mockResolvedValueOnce({ spreadsheet: { cells: {}, version: 3 } });
		mockUpdateSpreadsheet.mockResolvedValueOnce({ status: 'saved', file: { name: 'sheet' } });
		const update = await executeDeskToolCall(ctx(), 'desk_update_cells', {
			file_id: 'fil_abc',
			updates: [{ cell: 'A1', value: 1 }],
		});
		expect(update).toMatchObject({
			ok: true,
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

	it('fails with "File not found." when args are empty — the exact plan-replay bug', async () => {
		// Empty args → file_id is undefined → the mutation finds nothing → the
		// executor must report failure, never pretend the delete succeeded.
		mockDeleteFile.mockResolvedValueOnce(null);
		const out = await executeDeskToolCall(ctx(), 'desk_delete_file', {});
		expect(mockDeleteFile).toHaveBeenCalledWith(undefined, USER_ID, 'ai');
		expect(out).toEqual({ ok: false, output: null, errorMessage: 'File not found.' });
	});

	it('passes rename args (file_id + name) through verbatim', async () => {
		mockRenameFile.mockResolvedValueOnce({ id: 'fil_x', name: 'Q3 notes' });
		const out = await executeDeskToolCall(ctx(), 'desk_rename_file', { file_id: 'fil_x', name: 'Q3 notes' });
		expect(mockRenameFile).toHaveBeenCalledWith('fil_x', USER_ID, 'Q3 notes');
		expect(out).toMatchObject({ ok: true, output: { renamed: true, fileId: 'fil_x', name: 'Q3 notes' } });
	});

	it('rejects an unknown tool name instead of silently succeeding', async () => {
		const out = await executeDeskToolCall(ctx(), 'desk_obliterate_everything', { file_id: 'x' });
		expect(out).toEqual({
			ok: false,
			output: null,
			errorMessage: 'Unknown tool "desk_obliterate_everything" in proposal payload.',
		});
	});

	it('never throws — converts a mutation exception into a failed outcome', async () => {
		mockDeleteFile.mockRejectedValueOnce(new Error('DB exploded'));
		const out = await executeDeskToolCall(ctx(), 'desk_delete_file', { file_id: 'fil_abc' });
		expect(out).toEqual({ ok: false, output: null, errorMessage: 'DB exploded' });
	});

	it('every executable tool name is a desk mutation (sanity)', () => {
		expect(DESK_EXECUTABLE_TOOLS).toContain('desk_delete_file');
		expect(DESK_EXECUTABLE_TOOLS.every((t) => t.startsWith('desk_'))).toBe(true);
	});
	it('every executable tool declares a scope (drift guard)', () => {
		expect(Object.keys(TOOL_SCOPE).sort()).toEqual([...DESK_EXECUTABLE_TOOLS].sort());
	});
});

/**
 * Approval must not be a weaker door than the in-loop loop. The in-loop path
 * never assembles a tool whose scope was not granted; this path is handed a
 * persisted plan and has to refuse the same calls itself.
 */
describe('executeDeskToolCall — scope enforcement', () => {
	it('refuses a delete when desk:delete was not granted', async () => {
		const out = await executeDeskToolCall(ctx(['desk:read', 'desk:write']), 'desk_delete_file', {
			file_id: 'fil_abc',
		});
		expect(out.ok).toBe(false);
		expect(mockDeleteFile).not.toHaveBeenCalled();
	});

	it('refuses a write when only read was granted', async () => {
		const out = await executeDeskToolCall(ctx(['desk:read']), 'desk_rename_file', {
			file_id: 'fil_x',
			name: 'nope',
		});
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
		const out = await executeDeskToolCall(ctx(['desk:delete']), 'desk_delete_file', { file_id: 'fil_abc' });
		expect(out.ok).toBe(true);
		expect(mockDeleteFile).toHaveBeenCalledOnce();
	});

	it('names the missing permission rather than failing opaquely', async () => {
		const out = await executeDeskToolCall(ctx(['desk:read']), 'desk_delete_file', { file_id: 'fil_abc' });
		expect(out.ok).toBe(false);
		if (!out.ok) expect(out.errorMessage).toContain('desk:delete');
	});
});
