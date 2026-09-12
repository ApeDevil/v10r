import { beforeEach, describe, expect, it, vi } from 'vitest';

const { update, move, toggle } = vi.hoisted(() => ({ update: vi.fn(), move: vi.fn(), toggle: vi.fn() }));
vi.mock('$lib/server/db/desk/mutations', () => ({
	updateSpreadsheetByFileId: update,
	moveFile: move,
	toggleFileAiContext: toggle,
	renameFile: vi.fn(),
	deleteFile: vi.fn(),
	duplicateSpreadsheetFile: vi.fn(),
}));
vi.mock('$lib/server/db/desk/queries', () => ({
	getFile: vi.fn(),
	getMarkdownByFileId: vi.fn(),
	getSpreadsheetByFileId: vi.fn(),
}));
vi.mock('$lib/server/http/guards', () => ({ guardApiUser: () => ({ user: { id: 'user' } }) }));
vi.mock('$lib/server/http/rate-limit', () => ({
	createLimiter: () => ({ limit: async () => ({ success: true }) }),
	rateLimitResponse: vi.fn(),
}));

const { PUT } = await import('./+server');
const put = (body: unknown) =>
	PUT({
		params: { id: 'fil_test' },
		locals: {},
		request: new Request('https://example.test/api/desk/files/fil_test', {
			method: 'PUT',
			body: JSON.stringify(body),
		}),
	} as Parameters<typeof PUT>[0]);

beforeEach(() => vi.clearAllMocks());

describe('spreadsheet write HTTP contract', () => {
	it('requires a version before executing any mutations', async () => {
		const response = await put({ cells: {}, folderId: 'folder' });
		expect(response.status).toBe(400);
		expect(update).not.toHaveBeenCalled();
		expect(move).not.toHaveBeenCalled();
	});

	it('refuses mixed metadata operations rather than partially applying a conflicted request', async () => {
		const response = await put({ cells: {}, expectedVersion: 0, aiContext: true });
		expect(response.status).toBe(400);
		expect(update).not.toHaveBeenCalled();
		expect(toggle).not.toHaveBeenCalled();
	});

	it('returns an explicit 409 for stale versions', async () => {
		update.mockResolvedValueOnce({ status: 'conflict' });
		const response = await put({ cells: {}, expectedVersion: 2 });
		expect(response.status).toBe(409);
		expect(await response.json()).toMatchObject({ error: { code: 'version_conflict' } });
		expect(update).toHaveBeenCalledExactlyOnceWith('fil_test', 'user', { cells: {}, expectedVersion: 2 });
	});

	it('accepts the persisted cell shape and rejects a key the sheet cannot address', async () => {
		update.mockResolvedValueOnce({ status: 'saved', file: { id: 'fil_test' }, version: 1 });
		const cells = { A1: { v: 8, f: '=B1' }, B1: { v: 8 }, C1: { v: 'x', t: 'text' } };
		expect((await put({ cells, expectedVersion: 0 })).status).toBe(200);
		expect(update).toHaveBeenCalledExactlyOnceWith('fil_test', 'user', { cells, expectedVersion: 0 });

		expect((await put({ cells: { total: { v: 1 } }, expectedVersion: 0 })).status).toBe(400);
		expect((await put({ cells: { A1: { f: '=B1' } }, expectedVersion: 0 })).status).toBe(400);
		expect(update).toHaveBeenCalledOnce();
	});

	it('returns the new version for the next queued save', async () => {
		update.mockResolvedValueOnce({ status: 'saved', file: { id: 'fil_test' }, version: 3 });
		const response = await put({ cells: {}, expectedVersion: 2 });
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ data: { file: { id: 'fil_test' }, version: 3 } });
	});
});
