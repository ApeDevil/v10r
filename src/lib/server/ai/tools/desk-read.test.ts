/**
 * The read tools are bounded and say so: a page of files carries the offset of the next, a
 * cell beyond the first page is reachable by range, a long document by offset, and every
 * read names the file version it saw. Blog posts and assets are refused by kind.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({ db: {} }));

const mockListFiles = vi.fn();
const mockSearchFiles = vi.fn();
const mockGetFile = vi.fn();
const mockGetSpreadsheet = vi.fn();
const mockGetMarkdown = vi.fn();
vi.mock('$lib/server/db/desk/queries', () => ({
	listFiles: mockListFiles,
	searchFiles: mockSearchFiles,
	getFile: mockGetFile,
	getSpreadsheetByFileId: mockGetSpreadsheet,
	getMarkdownByFileId: mockGetMarkdown,
}));
vi.mock('$lib/server/desk/file-tree', () => ({ getFileTree: vi.fn(), renderFileTreeWithIndex: vi.fn() }));

const { createReadTools } = await import('./desk-read');
const { DESK_READ_MAX_CHARS } = await import('../config');

const USER = 'usr_read';
const ctx = { toolCallId: 'tc', messages: [] as never[], abortSignal: new AbortController().signal };
const AT = new Date('2026-09-12T08:00:00.000Z');
const tools = () => createReadTools(USER);

beforeEach(() => vi.clearAllMocks());

describe('desk_list_files', () => {
	it('pages through every file and says where the next page starts', async () => {
		mockListFiles.mockResolvedValueOnce({
			items: [{ id: 'fil_1', name: 'A', type: 'spreadsheet', updatedAt: AT }],
			total: 51,
		});
		const out = await tools().desk_list_files.execute?.({ file_type: 'all', offset: 50, limit: 10 }, ctx);
		expect(mockListFiles).toHaveBeenCalledWith(USER, undefined, 50, 10);
		expect(out).toMatchObject({ total: 51, nextOffset: null, files: [{ id: 'fil_1' }] });

		mockListFiles.mockResolvedValueOnce({
			items: Array.from({ length: 50 }, (_, i) => ({ id: `f${i}`, name: 'n', type: 'markdown', updatedAt: AT })),
			total: 60,
		});
		const first = await tools().desk_list_files.execute?.({ file_type: 'markdown', offset: 0, limit: 50 }, ctx);
		expect(mockListFiles).toHaveBeenLastCalledWith(USER, 'markdown', 0, 50);
		expect(first).toMatchObject({ nextOffset: 50 });
	});
});

describe('desk_search_files', () => {
	it('searches every owned file on the server, not the newest page', async () => {
		mockSearchFiles.mockResolvedValueOnce({
			items: [{ id: 'fil_old', name: 'Q1 budget', type: 'spreadsheet', updatedAt: AT }],
			total: 1,
		});
		const out = await tools().desk_search_files.execute?.({ query: 'q1', file_type: 'spreadsheet', limit: 20 }, ctx);
		expect(mockSearchFiles).toHaveBeenCalledWith(USER, 'q1', { type: 'spreadsheet', limit: 20 });
		expect(out).toMatchObject({ total: 1, files: [{ id: 'fil_old', name: 'Q1 budget' }] });
		expect(mockListFiles).not.toHaveBeenCalled();
	});
});

describe('desk_read_file', () => {
	const cells = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`A${i + 1}`, { v: i + 1 }]));

	it('shows the first page of cells and says how many there are', async () => {
		mockGetFile.mockResolvedValueOnce({ id: 'fil_s', name: 'Big', type: 'spreadsheet', updatedAt: AT });
		mockGetSpreadsheet.mockResolvedValueOnce({ spreadsheet: { cells, version: 4 } });
		const out = (await tools().desk_read_file.execute?.({ file_id: 'fil_s', offset: 0 }, ctx)) as Record<
			string,
			unknown
		>;
		expect(out.file).toMatchObject({ id: 'fil_s', version: 4, updatedAt: AT.toISOString() });
		expect(out).toMatchObject({ totalCells: 30, shownCells: 20, truncated: true });
		expect(out.content).toContain('and 10 more cells');
	});

	it('reads a cell beyond the first page by range', async () => {
		mockGetFile.mockResolvedValueOnce({ id: 'fil_s', name: 'Big', type: 'spreadsheet', updatedAt: AT });
		mockGetSpreadsheet.mockResolvedValueOnce({ spreadsheet: { cells, version: 4 } });
		const out = (await tools().desk_read_file.execute?.(
			{ file_id: 'fil_s', range: 'a25:a27', offset: 0 },
			ctx,
		)) as Record<string, unknown>;
		expect(out.content).toBe('A25: {"v":25}\nA26: {"v":26}\nA27: {"v":27}');
		expect(out).toMatchObject({ shownCells: 3, truncated: false });
	});

	it('reads a long document in windows and says where the next one starts', async () => {
		const text = 'x'.repeat(DESK_READ_MAX_CHARS + 100);
		mockGetFile.mockResolvedValue({ id: 'fil_m', name: 'Long', type: 'markdown', updatedAt: AT });
		mockGetMarkdown.mockResolvedValue({ file: {}, markdown: { content: text, version: 2 } });
		const head = (await tools().desk_read_file.execute?.({ file_id: 'fil_m', offset: 0 }, ctx)) as Record<
			string,
			unknown
		>;
		expect(head).toMatchObject({
			totalChars: text.length,
			truncated: true,
			nextOffset: DESK_READ_MAX_CHARS,
			offset: 0,
		});
		expect((head.content as string).length).toBe(DESK_READ_MAX_CHARS);
		const tail = (await tools().desk_read_file.execute?.(
			{ file_id: 'fil_m', offset: DESK_READ_MAX_CHARS },
			ctx,
		)) as Record<string, unknown>;
		expect(tail).toMatchObject({ truncated: true, nextOffset: null });
		expect((tail.content as string).length).toBe(100);
		expect((tail.file as { version: number }).version).toBe(2);
	});

	it('refuses a blog post or asset id by kind instead of "not found"', async () => {
		expect(await tools().desk_read_file.execute?.({ file_id: 'pst_abc', offset: 0 }, ctx)).toEqual({
			error: expect.stringContaining('blog post'),
		});
		expect(await tools().desk_read_file.execute?.({ file_id: 'ast_abc', offset: 0 }, ctx)).toEqual({
			error: expect.stringContaining('image asset'),
		});
		expect(mockGetFile).not.toHaveBeenCalled();
	});
});
