/**
 * The deskbot retrieval profile: its lane is the desk corpus only, a re-ingest never leaves a
 * gap, an unpin removes the copy at once, and every hit says which file it came from and
 * whether that file has moved on since it was indexed.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({ db: {} }));

const mockGetMarkdown = vi.fn();
const mockGetSpreadsheet = vi.fn();
const mockListFileTimestamps = vi.fn();
vi.mock('$lib/server/db/desk/queries', () => ({
	getMarkdownByFileId: mockGetMarkdown,
	getSpreadsheetByFileId: mockGetSpreadsheet,
	listFileTimestamps: mockListFileTimestamps,
}));
const mockDeleteDocument = vi.fn();
vi.mock('$lib/server/db/retrieval/mutations', () => ({ deleteDocument: mockDeleteDocument }));
const mockGetBySourcePath = vi.fn();
const mockListOrigins = vi.fn();
vi.mock('$lib/server/db/retrieval/queries', () => ({
	getDocumentBySourcePath: mockGetBySourcePath,
	listDocumentOrigins: mockListOrigins,
}));
const mockRetrieve = vi.fn();
vi.mock('$lib/server/retrieval', () => ({ retrieve: mockRetrieve }));
const mockIngest = vi.fn();
vi.mock('$lib/server/retrieval/ingest', () => ({ ingest: mockIngest }));
const mockDefer = vi.fn((_label: string, work: () => Promise<unknown>) => void work());
vi.mock('$lib/server/platform', () => ({ deferAfterResponse: mockDefer }));

const {
	attributeDeskHits,
	followAiContextChange,
	removeDeskFileFromRetrieval,
	retrieveDeskDocs,
	syncDeskFileToRetrieval,
} = await import('./deskbot-retrieval');

const USER = 'usr_r';
const T0 = new Date('2026-09-12T08:00:00.000Z');
const T1 = new Date('2026-09-12T09:00:00.000Z');

beforeEach(() => {
	vi.clearAllMocks();
	mockRetrieve.mockResolvedValue({ chunks: [] });
	mockDeleteDocument.mockResolvedValue(true);
});

describe('retrieveDeskDocs', () => {
	it('asks the kernel for the desk corpus only, tiers 1–2', async () => {
		await retrieveDeskDocs(USER, 'q');
		expect(mockRetrieve).toHaveBeenCalledWith('q', { userId: USER, tiers: [1, 2], maxChunks: 5, source: 'desk' });
	});
});

describe('syncDeskFileToRetrieval', () => {
	it('ingests the fresh copy before removing the previous one', async () => {
		mockGetMarkdown.mockResolvedValueOnce({ file: { name: 'Notes' }, markdown: { content: 'hello', version: 1 } });
		mockGetBySourcePath.mockResolvedValueOnce({ id: 'doc_old', updatedAt: T0, contentHash: 'h' });
		const order: string[] = [];
		mockIngest.mockImplementationOnce(async () => {
			order.push('ingest');
		});
		mockDeleteDocument.mockImplementationOnce(async () => {
			order.push('delete');
			return true;
		});
		expect(await syncDeskFileToRetrieval(USER, 'fil_1', 'markdown')).toBe(true);
		expect(order).toEqual(['ingest', 'delete']);
		expect(mockIngest).toHaveBeenCalledWith({
			title: 'Notes',
			content: 'hello',
			sourcePath: 'desk_file_fil_1',
			sourceType: 'desk',
			userId: USER,
		});
	});

	it('keeps the previous copy when the re-ingest throws', async () => {
		mockGetMarkdown.mockResolvedValueOnce({ file: { name: 'Notes' }, markdown: { content: 'hello', version: 1 } });
		mockGetBySourcePath.mockResolvedValueOnce({ id: 'doc_old', updatedAt: T0, contentHash: 'h' });
		mockIngest.mockRejectedValueOnce(new Error('embedding quota'));
		await expect(syncDeskFileToRetrieval(USER, 'fil_1', 'markdown')).rejects.toThrow('embedding quota');
		expect(mockDeleteDocument).not.toHaveBeenCalled();
	});

	it('drops the stale copy of a file that became empty, without ingesting', async () => {
		mockGetSpreadsheet.mockResolvedValueOnce({ file: { name: 'Empty' }, spreadsheet: { cells: {}, version: 0 } });
		mockGetBySourcePath.mockResolvedValueOnce({ id: 'doc_old', updatedAt: T0, contentHash: 'h' });
		expect(await syncDeskFileToRetrieval(USER, 'fil_2', 'spreadsheet')).toBe(false);
		expect(mockIngest).not.toHaveBeenCalled();
		expect(mockDeleteDocument).toHaveBeenCalledWith('doc_old', USER);
	});
});

describe('followAiContextChange', () => {
	it('pins ingest and unpins remove — off the response', async () => {
		mockGetBySourcePath.mockResolvedValueOnce({ id: 'doc_old', updatedAt: T0, contentHash: 'h' });
		followAiContextChange(USER, 'fil_1', 'markdown', false);
		expect(mockDefer).toHaveBeenCalledWith('desk-retrieval:unpin', expect.any(Function));
		await Promise.resolve();
		expect(mockDeleteDocument).toHaveBeenCalledWith('doc_old', USER);

		mockGetMarkdown.mockResolvedValueOnce({ file: { name: 'Notes' }, markdown: { content: 'x', version: 1 } });
		mockGetBySourcePath.mockResolvedValueOnce(null);
		followAiContextChange(USER, 'fil_1', 'markdown', true);
		expect(mockDefer).toHaveBeenLastCalledWith('desk-retrieval:pin', expect.any(Function));
	});

	it('removing a file with no copy is a no-op', async () => {
		mockGetBySourcePath.mockResolvedValueOnce(null);
		expect(await removeDeskFileFromRetrieval(USER, 'fil_none')).toBe(false);
		expect(mockDeleteDocument).not.toHaveBeenCalled();
	});
});

describe('attributeDeskHits', () => {
	it("names each hit's desk file, when it was indexed, and whether the file changed since", async () => {
		mockListOrigins.mockResolvedValueOnce([
			{ id: 'doc_a', sourceUri: 'desk_file_fil_a', updatedAt: T0 },
			{ id: 'doc_b', sourceUri: 'desk_file_fil_b', updatedAt: T1 },
		]);
		mockListFileTimestamps.mockResolvedValueOnce([
			{ id: 'fil_a', name: 'A', updatedAt: T1 },
			{ id: 'fil_b', name: 'B', updatedAt: T0 },
		]);
		const hits = await attributeDeskHits(USER, [
			{
				chunkId: 'c1',
				documentId: 'doc_a',
				documentTitle: 'A',
				content: 'x',
				score: 0.91234,
				source: 'vector',
				tier: 1,
			},
			{ chunkId: 'c2', documentId: 'doc_b', documentTitle: 'B', content: 'y', score: 0.5, source: 'bm25', tier: 1 },
		]);
		expect(hits).toEqual([
			{ fileId: 'fil_a', documentTitle: 'A', content: 'x', score: 0.912, indexedAt: T0.toISOString(), stale: true },
			{ fileId: 'fil_b', documentTitle: 'B', content: 'y', score: 0.5, indexedAt: T1.toISOString(), stale: false },
		]);
		expect(mockListFileTimestamps).toHaveBeenCalledWith(USER, ['fil_a', 'fil_b']);
	});
});
