/**
 * Tests for desk read tools — desk_get_open_panels.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({ db: {} }));
vi.mock('$lib/server/db/desk/queries', () => ({
	listFiles: vi.fn(),
	getFile: vi.fn(),
	getSpreadsheetByFileId: vi.fn(),
	getMarkdownByFileId: vi.fn(),
}));
vi.mock('$lib/server/desk/file-tree', () => ({
	getFileTree: vi.fn(),
	renderFileTreeWithIndex: vi.fn(),
}));

const { createReadTools } = await import('./desk-read');

const USER_ID = 'usr_test_read';

describe('desk_get_open_panels', () => {
	it('returns panels from injected deskLayout', async () => {
		const layout = [
			{ panelId: 'spreadsheet-f1', fileId: 'f1', fileType: 'spreadsheet', label: 'Budget' },
			{ panelId: 'editor-f2', fileId: 'f2', fileType: 'markdown', label: 'Notes' },
		];
		const tools = createReadTools(USER_ID, layout);
		const result = await tools.desk_get_open_panels.execute!({}, { toolCallId: 'tc1', messages: [], abortSignal: new AbortController().signal });

		expect(result).toEqual({
			panels: [
				{ panelId: 'spreadsheet-f1', fileId: 'f1', fileType: 'spreadsheet', label: 'Budget' },
				{ panelId: 'editor-f2', fileId: 'f2', fileType: 'markdown', label: 'Notes' },
			],
			total: 2,
		});
	});

	it('returns empty when no deskLayout provided', async () => {
		const tools = createReadTools(USER_ID);
		const result = await tools.desk_get_open_panels.execute!({}, { toolCallId: 'tc2', messages: [], abortSignal: new AbortController().signal });

		expect(result).toEqual({ panels: [], total: 0 });
	});

	it('returns empty for empty deskLayout array', async () => {
		const tools = createReadTools(USER_ID, []);
		const result = await tools.desk_get_open_panels.execute!({}, { toolCallId: 'tc3', messages: [], abortSignal: new AbortController().signal });

		expect(result).toEqual({ panels: [], total: 0 });
	});

	it('maps null fileId and fileType correctly', async () => {
		const layout = [{ panelId: 'explorer', label: 'Explorer' }];
		const tools = createReadTools(USER_ID, layout);
		const result = await tools.desk_get_open_panels.execute!({}, { toolCallId: 'tc4', messages: [], abortSignal: new AbortController().signal });

		expect(result).toEqual({
			panels: [{ panelId: 'explorer', fileId: null, fileType: null, label: 'Explorer' }],
			total: 1,
		});
	});
});
