/**
 * Tests for the destructive desk tool — desk_delete_file.
 *
 * It is HARD-GATED: it validates the target and returns a `requiresApproval` sentinel
 * instead of deleting in-loop. The real delete runs only via the approve-route replay
 * (`executeDeskToolCall` — see desk-execute.test.ts). A regression that re-adds an in-loop
 * delete (the old self-serve `confirmed` handshake the model could satisfy itself) must
 * fail the `deleteFile` was never called assertions below.
 *
 * (createCreateTools mutate-in-loop because they are reversible soft-deletes; covered elsewhere.)
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({ db: {} }));

const mockGetFile = vi.fn();
vi.mock('$lib/server/db/desk/queries', () => ({
	getFile: mockGetFile,
}));

// desk-create imports createMarkdownFile/createSpreadsheetFile from mutations; deleteFile is
// NOT imported today. We stub the whole module and spy on deleteFile so that a regression which
// starts calling it in-loop is caught by the not.toHaveBeenCalled() assertions.
const mockDeleteFile = vi.fn();
vi.mock('$lib/server/db/desk/mutations', () => ({
	createMarkdownFile: vi.fn(),
	createSpreadsheetFile: vi.fn(),
	deleteFile: mockDeleteFile,
}));

const { createDeleteTools } = await import('./desk-create');

const USER_ID = 'usr_test_delete';
const ctx = { toolCallId: 'tc1', messages: [] as never[], abortSignal: new AbortController().signal };

describe('desk_delete_file (approval-gated, never deletes in-loop)', () => {
	it('returns a requiresApproval sentinel and does NOT call deleteFile', async () => {
		mockGetFile.mockResolvedValueOnce({ id: 'f1', name: 'Report.md', type: 'markdown' });
		const tools = createDeleteTools(USER_ID);
		const result = await tools.desk_delete_file.execute?.({ file_id: 'f1' }, ctx);

		expect(result).toMatchObject({ requiresApproval: true, fileId: 'f1', fileName: 'Report.md' });
		expect(mockDeleteFile).not.toHaveBeenCalled();
	});

	it('verifies ownership with the closure userId', async () => {
		mockGetFile.mockResolvedValueOnce({ id: 'f1', name: 'X', type: 'markdown' });
		const tools = createDeleteTools(USER_ID);
		await tools.desk_delete_file.execute?.({ file_id: 'f1' }, ctx);

		expect(mockGetFile).toHaveBeenCalledWith('f1', USER_ID);
	});

	it('returns an error and does NOT call deleteFile when the target is not found/owned', async () => {
		mockGetFile.mockResolvedValueOnce(null);
		const tools = createDeleteTools(USER_ID);
		const result = await tools.desk_delete_file.execute?.({ file_id: 'nope' }, ctx);

		expect(result).toEqual({ error: 'File not found or not accessible.' });
		expect(mockDeleteFile).not.toHaveBeenCalled();
	});
});
