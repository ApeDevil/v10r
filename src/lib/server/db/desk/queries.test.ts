import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFile, makeFolder, makeMarkdown, makeSpreadsheet, makeUser } from '$lib/server/test/fixtures';
import { user } from '../schema/auth/_better-auth';
import { file } from '../schema/desk/file';
import { folder } from '../schema/desk/folder';
import { markdown } from '../schema/desk/markdown';
import { spreadsheet } from '../schema/desk/spreadsheet';

let testClient: PGlite;

vi.mock('$lib/server/db', async () => {
	const { createTestDb } = await import('$lib/server/test/db');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

const {
	getFile,
	listFiles,
	getSpreadsheet,
	listSpreadsheets,
	getFolder,
	listFolders,
	countFolderContents,
	getSpreadsheetByFileId,
	getMarkdownByFileId,
	getAiContextFiles,
} = await import('./queries');
const { db } = await import('$lib/server/db');

const USER_A = makeUser({ id: 'user-a' });
const USER_B = makeUser({ id: 'user-b' });

describe('desk queries', () => {
	beforeAll(async () => {
		await db.insert(user).values([USER_A, USER_B]);
	});

	afterAll(async () => {
		await testClient?.close();
	});

	beforeEach(async () => {
		// Clean in reverse FK order
		await db.delete(markdown);
		await db.delete(spreadsheet);
		await db.delete(file);
		await db.delete(folder);
	});

	// ── getFile ──────────────────────────────────────────────────────

	describe('getFile', () => {
		it('returns a file when found with correct ownership', async () => {
			const f = makeFile({ userId: USER_A.id });
			await db.insert(file).values(f);

			const result = await getFile(f.id, USER_A.id);

			expect(result).not.toBeNull();
			expect(result?.id).toBe(f.id);
			expect(result?.name).toBe('Test File');
		});

		it('returns null when file does not exist', async () => {
			const result = await getFile('nonexistent', USER_A.id);
			expect(result).toBeNull();
		});

		it('returns null when file belongs to different user', async () => {
			const f = makeFile({ userId: USER_A.id });
			await db.insert(file).values(f);

			const result = await getFile(f.id, USER_B.id);
			expect(result).toBeNull();
		});
	});

	// ── listFiles ────────────────────────────────────────────────────

	describe('listFiles', () => {
		it('returns empty list when user has no files', async () => {
			const result = await listFiles(USER_A.id);
			expect(result.items).toHaveLength(0);
			expect(result.total).toBe(0);
		});

		it('returns all files for a user', async () => {
			await db
				.insert(file)
				.values([
					makeFile({ userId: USER_A.id, name: 'File 1', type: 'spreadsheet' }),
					makeFile({ userId: USER_A.id, name: 'File 2', type: 'markdown' }),
				]);

			const result = await listFiles(USER_A.id);
			expect(result.items).toHaveLength(2);
			expect(result.total).toBe(2);
		});

		it('filters by type correctly', async () => {
			await db
				.insert(file)
				.values([
					makeFile({ userId: USER_A.id, type: 'spreadsheet' }),
					makeFile({ userId: USER_A.id, type: 'markdown' }),
				]);

			const result = await listFiles(USER_A.id, 'spreadsheet');
			expect(result.items).toHaveLength(1);
			expect(result.items[0].type).toBe('spreadsheet');
			expect(result.total).toBe(1);
		});

		it('respects offset and limit for pagination', async () => {
			await db
				.insert(file)
				.values([
					makeFile({ userId: USER_A.id, name: 'A' }),
					makeFile({ userId: USER_A.id, name: 'B' }),
					makeFile({ userId: USER_A.id, name: 'C' }),
				]);

			const page1 = await listFiles(USER_A.id, undefined, 0, 2);
			expect(page1.items).toHaveLength(2);
			expect(page1.total).toBe(3);

			const page2 = await listFiles(USER_A.id, undefined, 2, 2);
			expect(page2.items).toHaveLength(1);
			expect(page2.total).toBe(3);
		});

		it('does not return files belonging to other users', async () => {
			await db.insert(file).values([makeFile({ userId: USER_A.id }), makeFile({ userId: USER_B.id })]);

			const result = await listFiles(USER_A.id);
			expect(result.items).toHaveLength(1);
			expect(result.total).toBe(1);
		});
	});

	// ── getSpreadsheet ───────────────────────────────────────────────

	describe('getSpreadsheet', () => {
		it('returns spreadsheet with correct ownership', async () => {
			const f = makeFile({ userId: USER_A.id });
			const s = makeSpreadsheet({ fileId: f.id, userId: USER_A.id, name: 'My Sheet' });
			await db.insert(file).values(f);
			await db.insert(spreadsheet).values(s);

			const result = await getSpreadsheet(s.id, USER_A.id);
			expect(result).not.toBeNull();
			expect(result?.id).toBe(s.id);
			expect(result?.name).toBe('My Sheet');
		});

		it('returns null when spreadsheet does not exist', async () => {
			const result = await getSpreadsheet('nonexistent', USER_A.id);
			expect(result).toBeNull();
		});

		it('returns null when spreadsheet belongs to different user', async () => {
			const f = makeFile({ userId: USER_A.id });
			const s = makeSpreadsheet({ fileId: f.id, userId: USER_A.id });
			await db.insert(file).values(f);
			await db.insert(spreadsheet).values(s);

			const result = await getSpreadsheet(s.id, USER_B.id);
			expect(result).toBeNull();
		});
	});

	// ── listSpreadsheets ─────────────────────────────────────────────

	describe('listSpreadsheets', () => {
		it('returns empty list when user has no spreadsheets', async () => {
			const result = await listSpreadsheets(USER_A.id);
			expect(result.items).toHaveLength(0);
			expect(result.total).toBe(0);
		});

		it('returns all spreadsheets for a user with total count', async () => {
			const f1 = makeFile({ userId: USER_A.id });
			const f2 = makeFile({ userId: USER_A.id });
			await db.insert(file).values([f1, f2]);
			await db
				.insert(spreadsheet)
				.values([
					makeSpreadsheet({ fileId: f1.id, userId: USER_A.id, name: 'Sheet 1' }),
					makeSpreadsheet({ fileId: f2.id, userId: USER_A.id, name: 'Sheet 2' }),
				]);

			const result = await listSpreadsheets(USER_A.id);
			expect(result.items).toHaveLength(2);
			expect(result.total).toBe(2);
		});

		it('respects pagination', async () => {
			const files = [makeFile({ userId: USER_A.id }), makeFile({ userId: USER_A.id }), makeFile({ userId: USER_A.id })];
			await db.insert(file).values(files);
			await db.insert(spreadsheet).values(files.map((f) => makeSpreadsheet({ fileId: f.id, userId: USER_A.id })));

			const page1 = await listSpreadsheets(USER_A.id, 0, 2);
			expect(page1.items).toHaveLength(2);
			expect(page1.total).toBe(3);
		});
	});

	// ── getFolder ────────────────────────────────────────────────────

	describe('getFolder', () => {
		it('returns a folder with correct ownership', async () => {
			const fol = makeFolder({ userId: USER_A.id, name: 'My Folder' });
			await db.insert(folder).values(fol);

			const result = await getFolder(fol.id, USER_A.id);
			expect(result).not.toBeNull();
			expect(result?.name).toBe('My Folder');
		});

		it('returns null when folder does not exist', async () => {
			const result = await getFolder('nonexistent', USER_A.id);
			expect(result).toBeNull();
		});

		it('returns null when folder belongs to different user', async () => {
			const fol = makeFolder({ userId: USER_A.id });
			await db.insert(folder).values(fol);

			const result = await getFolder(fol.id, USER_B.id);
			expect(result).toBeNull();
		});
	});

	// ── listFolders ──────────────────────────────────────────────────

	describe('listFolders', () => {
		it('returns empty list when user has no folders', async () => {
			const result = await listFolders(USER_A.id);
			expect(result.items).toHaveLength(0);
			expect(result.total).toBe(0);
		});

		it('returns all folders for a user', async () => {
			await db
				.insert(folder)
				.values([makeFolder({ userId: USER_A.id, name: 'Alpha' }), makeFolder({ userId: USER_A.id, name: 'Beta' })]);

			const result = await listFolders(USER_A.id);
			expect(result.items).toHaveLength(2);
			expect(result.total).toBe(2);
		});

		it('does not return folders belonging to other users', async () => {
			await db.insert(folder).values([makeFolder({ userId: USER_A.id }), makeFolder({ userId: USER_B.id })]);

			const result = await listFolders(USER_A.id);
			expect(result.items).toHaveLength(1);
		});
	});

	// ── countFolderContents ──────────────────────────────────────────

	describe('countFolderContents', () => {
		it('returns 0 for an empty folder', async () => {
			const fol = makeFolder({ userId: USER_A.id });
			await db.insert(folder).values(fol);

			const count = await countFolderContents(fol.id, USER_A.id);
			expect(count).toBe(0);
		});

		it('counts subfolders', async () => {
			const parent = makeFolder({ userId: USER_A.id });
			const child1 = makeFolder({ userId: USER_A.id, parentId: parent.id, name: 'Child 1' });
			const child2 = makeFolder({ userId: USER_A.id, parentId: parent.id, name: 'Child 2' });
			await db.insert(folder).values([parent, child1, child2]);

			const count = await countFolderContents(parent.id, USER_A.id);
			expect(count).toBe(2);
		});

		it('counts files in a folder', async () => {
			const fol = makeFolder({ userId: USER_A.id });
			await db.insert(folder).values(fol);
			await db
				.insert(file)
				.values([makeFile({ userId: USER_A.id, folderId: fol.id }), makeFile({ userId: USER_A.id, folderId: fol.id })]);

			const count = await countFolderContents(fol.id, USER_A.id);
			expect(count).toBe(2);
		});

		it('counts both subfolders and files together', async () => {
			const fol = makeFolder({ userId: USER_A.id });
			const subfol = makeFolder({ userId: USER_A.id, parentId: fol.id, name: 'Sub' });
			await db.insert(folder).values([fol, subfol]);
			await db.insert(file).values(makeFile({ userId: USER_A.id, folderId: fol.id }));

			const count = await countFolderContents(fol.id, USER_A.id);
			expect(count).toBe(2);
		});
	});

	// ── getSpreadsheetByFileId ───────────────────────────────────────

	describe('getSpreadsheetByFileId', () => {
		it('returns joined file and spreadsheet data', async () => {
			const f = makeFile({ userId: USER_A.id, name: 'Joined File' });
			const s = makeSpreadsheet({ fileId: f.id, userId: USER_A.id });
			await db.insert(file).values(f);
			await db.insert(spreadsheet).values(s);

			const result = await getSpreadsheetByFileId(f.id, USER_A.id);

			expect(result).not.toBeNull();
			expect(result).toHaveProperty('file');
			expect(result).toHaveProperty('spreadsheet');
			expect(result?.file.id).toBe(f.id);
			expect(result?.file.name).toBe('Joined File');
			expect(result?.spreadsheet.id).toBe(s.id);
		});

		it('returns null when file does not exist', async () => {
			const result = await getSpreadsheetByFileId('nonexistent', USER_A.id);
			expect(result).toBeNull();
		});

		it('returns null when file belongs to different user', async () => {
			const f = makeFile({ userId: USER_A.id });
			const s = makeSpreadsheet({ fileId: f.id, userId: USER_A.id });
			await db.insert(file).values(f);
			await db.insert(spreadsheet).values(s);

			const result = await getSpreadsheetByFileId(f.id, USER_B.id);
			expect(result).toBeNull();
		});
	});

	// ── getMarkdownByFileId ──────────────────────────────────────────

	describe('getMarkdownByFileId', () => {
		it('returns joined file and markdown data', async () => {
			const f = makeFile({ userId: USER_A.id, type: 'markdown', name: 'My Doc' });
			const m = makeMarkdown({ fileId: f.id, userId: USER_A.id, content: '# Hello' });
			await db.insert(file).values(f);
			await db.insert(markdown).values(m);

			const result = await getMarkdownByFileId(f.id, USER_A.id);

			expect(result).not.toBeNull();
			expect(result).toHaveProperty('file');
			expect(result).toHaveProperty('markdown');
			expect(result?.file.name).toBe('My Doc');
			expect(result?.markdown.content).toBe('# Hello');
		});

		it('returns null when file does not exist', async () => {
			const result = await getMarkdownByFileId('nonexistent', USER_A.id);
			expect(result).toBeNull();
		});

		it('returns null when file belongs to different user', async () => {
			const f = makeFile({ userId: USER_A.id, type: 'markdown' });
			const m = makeMarkdown({ fileId: f.id, userId: USER_A.id });
			await db.insert(file).values(f);
			await db.insert(markdown).values(m);

			const result = await getMarkdownByFileId(f.id, USER_B.id);
			expect(result).toBeNull();
		});
	});

	// ── getAiContextFiles ────────────────────────────────────────────

	describe('getAiContextFiles', () => {
		it('returns only files with aiContext=true', async () => {
			await db
				.insert(file)
				.values([
					makeFile({ userId: USER_A.id, aiContext: true, name: 'AI File' }),
					makeFile({ userId: USER_A.id, aiContext: false, name: 'Normal File' }),
				]);

			const result = await getAiContextFiles(USER_A.id);
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe('AI File');
		});

		it('returns empty list when no files have aiContext=true', async () => {
			await db.insert(file).values(makeFile({ userId: USER_A.id, aiContext: false }));

			const result = await getAiContextFiles(USER_A.id);
			expect(result).toHaveLength(0);
		});

		it('isolates results by user', async () => {
			await db
				.insert(file)
				.values([makeFile({ userId: USER_A.id, aiContext: true }), makeFile({ userId: USER_B.id, aiContext: true })]);

			const result = await getAiContextFiles(USER_A.id);
			expect(result).toHaveLength(1);
			expect(result[0]).not.toHaveProperty('userId', USER_B.id);
		});
	});
});
