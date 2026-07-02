/**
 * Tests for desk write tools — desk_update_markdown, desk_update_cells, desk_rename_file.
 *
 * These tools are HARD-GATED: they validate the target and return a
 * `requiresApproval` sentinel instead of mutating in-loop. The actual write runs
 * only via the approve-route replay (`executeDeskToolCall` — see desk-execute.test.ts).
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({ db: {} }));

const mockGetFile = vi.fn();
vi.mock('$lib/server/db/desk/queries', () => ({
	getFile: mockGetFile,
}));

const { createWriteTools } = await import('./desk-write');

const USER_ID = 'usr_test_write';
const ctx = { toolCallId: 'tc1', messages: [] as never[], abortSignal: new AbortController().signal };

describe('desk_update_markdown (approval-gated)', () => {
	it('returns a requiresApproval sentinel without mutating', async () => {
		mockGetFile.mockResolvedValueOnce({ id: 'f1', name: 'Notes.md', type: 'markdown' });
		const tools = createWriteTools(USER_ID);
		const result = await tools.desk_update_markdown.execute?.({ file_id: 'f1', content: '# Updated' }, ctx);

		expect(result).toMatchObject({
			requiresApproval: true,
			fileId: 'f1',
			fileName: 'Notes.md',
		});
	});

	it('returns error when file not found', async () => {
		mockGetFile.mockResolvedValueOnce(null);
		const tools = createWriteTools(USER_ID);
		const result = await tools.desk_update_markdown.execute?.({ file_id: 'nonexistent', content: '# x' }, ctx);

		expect(result).toEqual({ error: 'Markdown file not found or not accessible.' });
	});

	it('returns error when the target is not a markdown document', async () => {
		mockGetFile.mockResolvedValueOnce({ id: 'f1', name: 'Sheet', type: 'spreadsheet' });
		const tools = createWriteTools(USER_ID);
		const result = await tools.desk_update_markdown.execute?.({ file_id: 'f1', content: '# x' }, ctx);

		expect(result).toEqual({ error: 'That file is not a markdown document.' });
	});

	it('passes the userId from closure to the ownership check', async () => {
		mockGetFile.mockResolvedValueOnce({ id: 'f1', name: 'Notes', type: 'markdown' });
		const tools = createWriteTools(USER_ID);
		await tools.desk_update_markdown.execute?.({ file_id: 'f1', content: 'x' }, ctx);

		expect(mockGetFile).toHaveBeenCalledWith('f1', USER_ID);
	});
});

describe('desk_update_cells (approval-gated)', () => {
	it('returns a requiresApproval sentinel for a spreadsheet target', async () => {
		mockGetFile.mockResolvedValueOnce({ id: 's1', name: 'Budget', type: 'spreadsheet' });
		const tools = createWriteTools(USER_ID);
		const result = await tools.desk_update_cells.execute?.({ file_id: 's1', updates: [{ cell: 'A1', value: 1 }] }, ctx);

		expect(result).toMatchObject({ requiresApproval: true, fileId: 's1', fileName: 'Budget' });
	});

	it('returns error when the target is not a spreadsheet', async () => {
		mockGetFile.mockResolvedValueOnce({ id: 'm1', name: 'Notes', type: 'markdown' });
		const tools = createWriteTools(USER_ID);
		const result = await tools.desk_update_cells.execute?.({ file_id: 'm1', updates: [{ cell: 'A1', value: 1 }] }, ctx);

		expect(result).toEqual({ error: 'That file is not a spreadsheet.' });
	});
});

describe('desk_rename_file (approval-gated)', () => {
	it('returns a requiresApproval sentinel', async () => {
		mockGetFile.mockResolvedValueOnce({ id: 'f1', name: 'Old', type: 'markdown' });
		const tools = createWriteTools(USER_ID);
		const result = await tools.desk_rename_file.execute?.({ file_id: 'f1', name: 'New' }, ctx);

		expect(result).toMatchObject({ requiresApproval: true, fileId: 'f1', fileName: 'Old' });
	});

	it('returns error when file not found', async () => {
		mockGetFile.mockResolvedValueOnce(null);
		const tools = createWriteTools(USER_ID);
		const result = await tools.desk_rename_file.execute?.({ file_id: 'nope', name: 'New' }, ctx);

		expect(result).toEqual({ error: 'File not found or not accessible.' });
	});
});
