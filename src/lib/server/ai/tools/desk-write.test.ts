/**
 * Tests for desk write tools — desk_update_markdown.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({ db: {} }));
vi.mock('$lib/server/db/desk/queries', () => ({
	getSpreadsheetByFileId: vi.fn(),
}));

const mockUpdateMarkdown = vi.fn();
const mockRenameFile = vi.fn();
const mockUpdateSpreadsheet = vi.fn();

vi.mock('$lib/server/db/desk/mutations', () => ({
	updateSpreadsheetByFileId: mockUpdateSpreadsheet,
	updateMarkdownByFileId: mockUpdateMarkdown,
	renameFile: mockRenameFile,
}));

const { createWriteTools } = await import('./desk-write');

const USER_ID = 'usr_test_write';
const ctx = { toolCallId: 'tc1', messages: [] as never[], abortSignal: new AbortController().signal };

describe('desk_update_markdown', () => {
	it('returns updated=true with effects on success', async () => {
		mockUpdateMarkdown.mockResolvedValueOnce({ id: 'f1', name: 'Notes.md' });
		const tools = createWriteTools(USER_ID);
		const result = await tools.desk_update_markdown.execute?.({ file_id: 'f1', content: '# Updated' }, ctx);

		expect(result).toMatchObject({
			updated: true,
			fileId: 'f1',
			fileName: 'Notes.md',
		});
		expect((result as { effects: unknown[] }).effects).toEqual([
			{ type: 'desk:refresh_file', fileId: 'f1' },
			{ type: 'desk:tab_indicator', fileId: 'f1', panelType: 'editor', variant: 'modified' },
		]);
	});

	it('returns error when file not found', async () => {
		mockUpdateMarkdown.mockResolvedValueOnce(null);
		const tools = createWriteTools(USER_ID);
		const result = await tools.desk_update_markdown.execute?.({ file_id: 'nonexistent', content: '# x' }, ctx);

		expect(result).toEqual({ error: 'Markdown file not found or not accessible.' });
	});

	it('returns error on DB exception', async () => {
		mockUpdateMarkdown.mockRejectedValueOnce(new Error('DB fail'));
		const tools = createWriteTools(USER_ID);
		const result = await tools.desk_update_markdown.execute?.({ file_id: 'f1', content: '# x' }, ctx);

		expect(result).toEqual({ error: 'Failed to update markdown.' });
	});

	it('passes userId from closure to mutation', async () => {
		mockUpdateMarkdown.mockResolvedValueOnce({ id: 'f1', name: 'Notes' });
		const tools = createWriteTools(USER_ID);
		await tools.desk_update_markdown.execute?.({ file_id: 'f1', content: 'x' }, ctx);

		expect(mockUpdateMarkdown).toHaveBeenCalledWith('f1', USER_ID, 'x');
	});
});
