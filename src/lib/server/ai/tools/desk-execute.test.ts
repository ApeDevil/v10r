/**
 * Tests for `executeDeskToolCall` — the one-door SSOT both the in-loop desk
 * tools and the proposal-approval replay route mutations through.
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

const { executeDeskToolCall, DESK_EXECUTABLE_TOOLS } = await import('./desk-execute');

const USER_ID = 'usr_exec_test';

beforeEach(() => {
	vi.clearAllMocks();
});

describe('executeDeskToolCall — replay arg contract', () => {
	it('deletes the file when given a real file_id (args reach the mutation verbatim)', async () => {
		mockDeleteFile.mockResolvedValueOnce({ id: 'fil_abc', name: 'alpha' });
		const out = await executeDeskToolCall(USER_ID, 'desk_delete_file', { file_id: 'fil_abc' });
		// Replay tags the mutation as AI-originated so the pre-image revision is attributable.
		expect(mockDeleteFile).toHaveBeenCalledWith('fil_abc', USER_ID, 'ai');
		expect(out).toEqual({ ok: true, output: { deleted: true, fileId: 'fil_abc', name: 'alpha' } });
	});

	it('fails with "File not found." when args are empty — the exact plan-replay bug', async () => {
		// Empty args → file_id is undefined → the mutation finds nothing → the
		// executor must report failure, never pretend the delete succeeded.
		mockDeleteFile.mockResolvedValueOnce(null);
		const out = await executeDeskToolCall(USER_ID, 'desk_delete_file', {});
		expect(mockDeleteFile).toHaveBeenCalledWith(undefined, USER_ID, 'ai');
		expect(out).toEqual({ ok: false, output: null, errorMessage: 'File not found.' });
	});

	it('passes rename args (file_id + name) through verbatim', async () => {
		mockRenameFile.mockResolvedValueOnce({ id: 'fil_x', name: 'Q3 notes' });
		const out = await executeDeskToolCall(USER_ID, 'desk_rename_file', { file_id: 'fil_x', name: 'Q3 notes' });
		expect(mockRenameFile).toHaveBeenCalledWith('fil_x', USER_ID, 'Q3 notes');
		expect(out).toMatchObject({ ok: true, output: { renamed: true, fileId: 'fil_x', name: 'Q3 notes' } });
	});

	it('rejects an unknown tool name instead of silently succeeding', async () => {
		const out = await executeDeskToolCall(USER_ID, 'desk_obliterate_everything', { file_id: 'x' });
		expect(out).toEqual({
			ok: false,
			output: null,
			errorMessage: 'Unknown tool "desk_obliterate_everything" in proposal payload.',
		});
	});

	it('never throws — converts a mutation exception into a failed outcome', async () => {
		mockDeleteFile.mockRejectedValueOnce(new Error('DB exploded'));
		const out = await executeDeskToolCall(USER_ID, 'desk_delete_file', { file_id: 'fil_abc' });
		expect(out).toEqual({ ok: false, output: null, errorMessage: 'DB exploded' });
	});

	it('every executable tool name is a desk mutation (sanity)', () => {
		expect(DESK_EXECUTABLE_TOOLS).toContain('desk_delete_file');
		expect(DESK_EXECUTABLE_TOOLS.every((t) => t.startsWith('desk_'))).toBe(true);
	});
});
