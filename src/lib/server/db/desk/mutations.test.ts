import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFile, makeFolder, makeUser } from '$lib/server/test/fixtures';
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
	createSpreadsheetFile,
	renameFile,
	deleteFile,
	moveFile,
	toggleFileAiContext,
	duplicateSpreadsheetFile,
	createFolder,
	renameFolder,
	moveFolder,
	deleteFolder,
	updateSpreadsheetByFileId,
	createMarkdownFile,
	updateMarkdownByFileId,
} = await import('./mutations');
const { db } = await import('$lib/server/db');

const USER_A = makeUser({ id: 'user-a' });
const USER_B = makeUser({ id: 'user-b' });

describe('desk mutations', () => {
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

	describe('createSpreadsheetFile', () => {
		it('creates both a file and spreadsheet row in a transaction', async () => {
			const result = await createSpreadsheetFile(USER_A.id, 'Budget');

			expect(result.file).toBeDefined();
			expect(result.spreadsheet).toBeDefined();
			expect(result.file.name).toBe('Budget');
			expect(result.file.type).toBe('spreadsheet');
			expect(result.file.userId).toBe(USER_A.id);
			expect(result.spreadsheet.userId).toBe(USER_A.id);
		});

		it('spreadsheet fileId matches the created file id', async () => {
			const result = await createSpreadsheetFile(USER_A.id);

			expect(result.spreadsheet.fileId).toBe(result.file.id);
		});

		it('persists both rows so they can be retrieved independently', async () => {
			const result = await createSpreadsheetFile(USER_A.id, 'Verify');

			const [fileRow] = await db.select().from(file).where(eq(file.id, result.file.id));
			const [sheetRow] = await db.select().from(spreadsheet).where(eq(spreadsheet.id, result.spreadsheet.id));

			expect(fileRow).toBeDefined();
			expect(sheetRow).toBeDefined();
		});

		it('places file in the specified folder', async () => {
			const fol = makeFolder({ userId: USER_A.id });
			await db.insert(folder).values(fol);

			const result = await createSpreadsheetFile(USER_A.id, 'Foldered', {}, fol.id);

			expect(result.file.folderId).toBe(fol.id);
		});
	});

	describe('renameFile', () => {
		it('renames a file and returns the updated row', async () => {
			const f = makeFile({ userId: USER_A.id, name: 'Old Name' });
			await db.insert(file).values(f);

			const result = await renameFile(f.id, USER_A.id, 'New Name');

			expect(result).not.toBeNull();
			expect(result?.name).toBe('New Name');
		});

		it('returns null when file belongs to different user', async () => {
			const f = makeFile({ userId: USER_A.id });
			await db.insert(file).values(f);

			const result = await renameFile(f.id, USER_B.id, 'Hijacked');
			expect(result).toBeNull();
		});

		it('returns null when file does not exist', async () => {
			const result = await renameFile('nonexistent', USER_A.id, 'Ghost');
			expect(result).toBeNull();
		});
	});

	describe('deleteFile (soft delete)', () => {
		it('sets deleted_at on the file row and returns it', async () => {
			const f = makeFile({ userId: USER_A.id });
			await db.insert(file).values(f);

			const result = await deleteFile(f.id, USER_A.id);

			expect(result).not.toBeNull();
			expect(result?.id).toBe(f.id);
			expect(result?.deletedAt).not.toBeNull();

			// Row still physically present — soft-deleted, not dropped.
			const [check] = await db.select().from(file).where(eq(file.id, f.id));
			expect(check).toBeDefined();
			expect(check?.deletedAt).not.toBeNull();
		});

		it('soft-deletes the matching spreadsheet detail row', async () => {
			const { file: fileRow, spreadsheet: sheetRow } = await createSpreadsheetFile(USER_A.id, 'Cascade Test');

			await deleteFile(fileRow.id, USER_A.id);

			// The spreadsheet row is still present but deletedAt is set.
			const [sheetCheck] = await db.select().from(spreadsheet).where(eq(spreadsheet.id, sheetRow.id));
			expect(sheetCheck).toBeDefined();
			expect(sheetCheck?.deletedAt).not.toBeNull();
		});

		it('returns null when file belongs to different user', async () => {
			const f = makeFile({ userId: USER_A.id });
			await db.insert(file).values(f);

			const result = await deleteFile(f.id, USER_B.id);
			expect(result).toBeNull();

			// File must still exist and must NOT be soft-deleted.
			const [check] = await db.select().from(file).where(eq(file.id, f.id));
			expect(check).toBeDefined();
			expect(check?.deletedAt).toBeNull();
		});

		it('returns null when the file is already soft-deleted', async () => {
			const f = makeFile({ userId: USER_A.id });
			await db.insert(file).values(f);

			const first = await deleteFile(f.id, USER_A.id);
			expect(first).not.toBeNull();

			const second = await deleteFile(f.id, USER_A.id);
			expect(second).toBeNull();
		});
	});

	describe('moveFile', () => {
		it('moves a file into a folder', async () => {
			const f = makeFile({ userId: USER_A.id });
			const fol = makeFolder({ userId: USER_A.id });
			await db.insert(folder).values(fol);
			await db.insert(file).values(f);

			const result = await moveFile(f.id, USER_A.id, fol.id);

			expect(result).not.toBeNull();
			expect(result?.folderId).toBe(fol.id);
		});

		it('moves a file to root (null folderId)', async () => {
			const fol = makeFolder({ userId: USER_A.id });
			await db.insert(folder).values(fol);
			const f = makeFile({ userId: USER_A.id, folderId: fol.id });
			await db.insert(file).values(f);

			const result = await moveFile(f.id, USER_A.id, null);

			expect(result?.folderId).toBeNull();
		});

		it('returns null when file belongs to different user', async () => {
			const f = makeFile({ userId: USER_A.id });
			await db.insert(file).values(f);

			const result = await moveFile(f.id, USER_B.id, null);
			expect(result).toBeNull();
		});
	});

	describe('toggleFileAiContext', () => {
		it('enables aiContext on a file', async () => {
			const f = makeFile({ userId: USER_A.id, aiContext: false });
			await db.insert(file).values(f);

			const result = await toggleFileAiContext(f.id, USER_A.id, true);

			expect(result).not.toBeNull();
			expect(result?.aiContext).toBe(true);
		});

		it('disables aiContext on a file', async () => {
			const f = makeFile({ userId: USER_A.id, aiContext: true });
			await db.insert(file).values(f);

			const result = await toggleFileAiContext(f.id, USER_A.id, false);

			expect(result?.aiContext).toBe(false);
		});

		it('returns null when file belongs to different user', async () => {
			const f = makeFile({ userId: USER_A.id });
			await db.insert(file).values(f);

			const result = await toggleFileAiContext(f.id, USER_B.id, true);
			expect(result).toBeNull();
		});
	});

	describe('duplicateSpreadsheetFile', () => {
		it('returns null when original file does not exist', async () => {
			const result = await duplicateSpreadsheetFile('nonexistent', USER_A.id);
			expect(result).toBeNull();
		});

		it('returns null when file belongs to different user', async () => {
			const { file: fileRow } = await createSpreadsheetFile(USER_A.id, 'Owned');

			const result = await duplicateSpreadsheetFile(fileRow.id, USER_B.id);
			expect(result).toBeNull();
		});

		it('creates first duplicate with "X copy" name', async () => {
			const cells = { A1: { v: 'data', t: 'text' } };
			const { file: fileRow } = await createSpreadsheetFile(USER_A.id, 'Report', cells);

			const dup = await duplicateSpreadsheetFile(fileRow.id, USER_A.id);

			expect(dup).not.toBeNull();
			expect(dup?.file.name).toBe('Report copy');
		});

		it('creates second duplicate with "X copy 2" name', async () => {
			const { file: fileRow } = await createSpreadsheetFile(USER_A.id, 'Report');
			// First duplicate
			await duplicateSpreadsheetFile(fileRow.id, USER_A.id);
			// Second duplicate
			const dup2 = await duplicateSpreadsheetFile(fileRow.id, USER_A.id);

			expect(dup2?.file.name).toBe('Report copy 2');
		});

		it('copies cells from the original spreadsheet', async () => {
			const cells = { A1: { v: 'copied', t: 'text' }, B2: { v: 99 } };
			const { file: fileRow } = await createSpreadsheetFile(USER_A.id, 'Sheet', cells);

			const dup = await duplicateSpreadsheetFile(fileRow.id, USER_A.id);

			expect(dup?.spreadsheet?.cells).toEqual(cells);
		});

		it('creates an independent file row distinct from the original', async () => {
			const { file: fileRow } = await createSpreadsheetFile(USER_A.id, 'Original');
			const dup = await duplicateSpreadsheetFile(fileRow.id, USER_A.id);

			expect(dup?.file.id).not.toBe(fileRow.id);
			expect(dup?.spreadsheet?.fileId).toBe(dup?.file.id);
		});
	});

	describe('createFolder', () => {
		it('creates a folder with default name', async () => {
			const result = await createFolder(USER_A.id);

			expect(result).toBeDefined();
			expect(result.name).toBe('New Folder');
			expect(result.userId).toBe(USER_A.id);
			expect(result.parentId).toBeNull();
		});

		it('creates a folder with a custom name and parent', async () => {
			const parent = await createFolder(USER_A.id, 'Parent');
			const child = await createFolder(USER_A.id, 'Child', parent.id);

			expect(child.name).toBe('Child');
			expect(child.parentId).toBe(parent.id);
		});
	});

	describe('renameFolder', () => {
		it('renames a folder and returns the updated row', async () => {
			const fol = makeFolder({ userId: USER_A.id, name: 'Old' });
			await db.insert(folder).values(fol);

			const result = await renameFolder(fol.id, USER_A.id, 'New');

			expect(result.name).toBe('New');
		});

		it('throws FolderNotFoundError when folder belongs to different user', async () => {
			const { FolderNotFoundError } = await import('./errors');
			const fol = makeFolder({ userId: USER_A.id });
			await db.insert(folder).values(fol);

			await expect(renameFolder(fol.id, USER_B.id, 'Hijacked')).rejects.toBeInstanceOf(FolderNotFoundError);
		});

		it('throws FolderNameConflictError when sibling already has that name', async () => {
			const { FolderNameConflictError } = await import('./errors');
			await createFolder(USER_A.id, 'Existing');
			const other = await createFolder(USER_A.id, 'Other');

			await expect(renameFolder(other.id, USER_A.id, 'Existing')).rejects.toBeInstanceOf(FolderNameConflictError);
		});
	});

	describe('moveFolder', () => {
		it('moves a folder to a new parent', async () => {
			const parent = await createFolder(USER_A.id, 'Parent');
			const child = await createFolder(USER_A.id, 'Child');

			const result = await moveFolder(child.id, USER_A.id, parent.id);

			expect(result.parentId).toBe(parent.id);
		});

		it('moves a folder to root (null parentId)', async () => {
			const parent = await createFolder(USER_A.id, 'Parent');
			const child = await createFolder(USER_A.id, 'Child', parent.id);

			const result = await moveFolder(child.id, USER_A.id, null);

			expect(result.parentId).toBeNull();
		});

		it('throws FolderNotFoundError when folder belongs to different user', async () => {
			const { FolderNotFoundError } = await import('./errors');
			const fol = makeFolder({ userId: USER_A.id });
			await db.insert(folder).values(fol);

			await expect(moveFolder(fol.id, USER_B.id, null)).rejects.toBeInstanceOf(FolderNotFoundError);
		});

		it('throws FolderCycleError when moving a folder into its own descendant', async () => {
			const { FolderCycleError } = await import('./errors');
			const a = await createFolder(USER_A.id, 'A');
			const b = await createFolder(USER_A.id, 'B', a.id);
			const c = await createFolder(USER_A.id, 'C', b.id);

			await expect(moveFolder(a.id, USER_A.id, c.id)).rejects.toBeInstanceOf(FolderCycleError);
		});

		it('throws FolderCycleError when moving a folder into itself', async () => {
			const { FolderCycleError } = await import('./errors');
			const a = await createFolder(USER_A.id, 'A');

			await expect(moveFolder(a.id, USER_A.id, a.id)).rejects.toBeInstanceOf(FolderCycleError);
		});

		it('throws FolderNameConflictError when destination parent already has a sibling with the same name', async () => {
			const { FolderNameConflictError } = await import('./errors');
			const parent = await createFolder(USER_A.id, 'Parent');
			await createFolder(USER_A.id, 'Docs', parent.id);
			const loose = await createFolder(USER_A.id, 'Docs');

			await expect(moveFolder(loose.id, USER_A.id, parent.id)).rejects.toBeInstanceOf(FolderNameConflictError);
		});
	});

	describe('deleteFolder', () => {
		it('deletes an empty folder and returns its id', async () => {
			const fol = makeFolder({ userId: USER_A.id });
			await db.insert(folder).values(fol);

			const result = await deleteFolder(fol.id, USER_A.id);

			expect(result.id).toBe(fol.id);
			expect(result.deletedIds).toEqual([fol.id]);

			const [check] = await db.select().from(folder).where(eq(folder.id, fol.id));
			expect(check).toBeUndefined();
		});

		it('throws FolderNotFoundError when folder belongs to different user', async () => {
			const { FolderNotFoundError } = await import('./errors');
			const fol = makeFolder({ userId: USER_A.id });
			await db.insert(folder).values(fol);

			await expect(deleteFolder(fol.id, USER_B.id)).rejects.toBeInstanceOf(FolderNotFoundError);

			const [check] = await db.select().from(folder).where(eq(folder.id, fol.id));
			expect(check).toBeDefined();
		});

		it('throws FolderNotEmptyError when folder has children and recursive is false', async () => {
			const { FolderNotEmptyError } = await import('./errors');
			const parent = await createFolder(USER_A.id, 'Parent');
			await createFolder(USER_A.id, 'Child', parent.id);

			await expect(deleteFolder(parent.id, USER_A.id)).rejects.toBeInstanceOf(FolderNotEmptyError);

			// Untouched
			const [check] = await db.select().from(folder).where(eq(folder.id, parent.id));
			expect(check).toBeDefined();
		});

		it('recursively deletes a 3-level tree and reports every deleted id', async () => {
			const a = await createFolder(USER_A.id, 'A');
			const b = await createFolder(USER_A.id, 'B', a.id);
			const c = await createFolder(USER_A.id, 'C', b.id);

			const result = await deleteFolder(a.id, USER_A.id, { recursive: true });

			expect(result.deletedIds).toHaveLength(3);
			expect(new Set(result.deletedIds)).toEqual(new Set([a.id, b.id, c.id]));

			// All gone via CASCADE
			const remaining = await db.select().from(folder).where(eq(folder.userId, USER_A.id));
			expect(remaining).toHaveLength(0);
		});
	});

	describe('updateSpreadsheetByFileId', () => {
		it('updates cells and touches file updatedAt', async () => {
			const { file: fileRow } = await createSpreadsheetFile(USER_A.id, 'Editable');
			const before = fileRow.updatedAt;

			// Small delay so updatedAt changes measurably
			await new Promise((r) => setTimeout(r, 10));

			const cells = { A1: { v: 'updated' } };
			const result = await updateSpreadsheetByFileId(fileRow.id, USER_A.id, { cells });

			expect(result).not.toBeNull();
			expect(result?.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());

			// Verify spreadsheet row was updated
			const [sheetRow] = await db.select().from(spreadsheet).where(eq(spreadsheet.fileId, fileRow.id));
			expect(sheetRow.cells).toEqual(cells);
		});

		it('updates file name when provided', async () => {
			const { file: fileRow } = await createSpreadsheetFile(USER_A.id, 'Old');

			const result = await updateSpreadsheetByFileId(fileRow.id, USER_A.id, { name: 'Renamed' });

			expect(result?.name).toBe('Renamed');
		});

		it('returns null when file belongs to different user', async () => {
			const { file: fileRow } = await createSpreadsheetFile(USER_A.id);

			const result = await updateSpreadsheetByFileId(fileRow.id, USER_B.id, {
				cells: { A1: { v: 'x' } },
			});
			expect(result).toBeNull();
		});

		it('returns null when file does not exist', async () => {
			const result = await updateSpreadsheetByFileId('nonexistent', USER_A.id, { cells: {} });
			expect(result).toBeNull();
		});
	});

	describe('createMarkdownFile', () => {
		it('creates both a file and markdown row in a transaction', async () => {
			const result = await createMarkdownFile(USER_A.id, 'My Doc', '# Hello');

			expect(result.file).toBeDefined();
			expect(result.markdown).toBeDefined();
			expect(result.file.type).toBe('markdown');
			expect(result.file.name).toBe('My Doc');
			expect(result.markdown.content).toBe('# Hello');
			expect(result.markdown.fileId).toBe(result.file.id);
		});

		it('creates with default name and empty content', async () => {
			const result = await createMarkdownFile(USER_A.id);

			expect(result.file.name).toBe('Untitled');
			expect(result.markdown.content).toBe('');
		});

		it('persists both rows so they can be retrieved independently', async () => {
			const result = await createMarkdownFile(USER_A.id, 'Persist Check');

			const [fileRow] = await db.select().from(file).where(eq(file.id, result.file.id));
			const [mdRow] = await db.select().from(markdown).where(eq(markdown.id, result.markdown.id));

			expect(fileRow).toBeDefined();
			expect(mdRow).toBeDefined();
		});

		it('places file in the specified folder', async () => {
			const fol = makeFolder({ userId: USER_A.id });
			await db.insert(folder).values(fol);

			const result = await createMarkdownFile(USER_A.id, 'In Folder', '', fol.id);

			expect(result.file.folderId).toBe(fol.id);
		});
	});

	describe('updateMarkdownByFileId', () => {
		it('updates markdown content and touches file updatedAt', async () => {
			const { file: fileRow } = await createMarkdownFile(USER_A.id, 'Doc', 'original');
			const before = fileRow.updatedAt;

			await new Promise((r) => setTimeout(r, 10));

			const result = await updateMarkdownByFileId(fileRow.id, USER_A.id, '# Updated');

			expect(result).not.toBeNull();
			expect(result?.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());

			// Verify markdown content was updated
			const [mdRow] = await db.select().from(markdown).where(eq(markdown.fileId, fileRow.id));
			expect(mdRow.content).toBe('# Updated');
		});

		it('returns null when file belongs to different user', async () => {
			const { file: fileRow } = await createMarkdownFile(USER_A.id);

			const result = await updateMarkdownByFileId(fileRow.id, USER_B.id, 'hijacked');
			expect(result).toBeNull();
		});

		it('returns null when file does not exist', async () => {
			const result = await updateMarkdownByFileId('nonexistent', USER_A.id, 'content');
			expect(result).toBeNull();
		});
	});
	//
	// The existing per-function tests prove the SOURCE row is the caller's, but
	// every one of them passes `null` as the destination — so a foreign
	// folderId/parentId went unexercised and was written unchecked. That let a
	// user file their own rows into another user's tree, which then became
	// reachable by that user's own cascade delete.

	describe('destination ownership', () => {
		it("refuses to move a file into another user's folder", async () => {
			const foreign = makeFolder({ userId: USER_B.id });
			await db.insert(folder).values(foreign);
			const f = makeFile({ userId: USER_A.id });
			await db.insert(file).values(f);

			await expect(moveFile(f.id, USER_A.id, foreign.id)).rejects.toThrow();

			const [row] = await db.select().from(file).where(eq(file.id, f.id));
			expect(row.folderId).toBeNull();
		});

		it("refuses to create a folder under another user's folder", async () => {
			const foreign = makeFolder({ userId: USER_B.id });
			await db.insert(folder).values(foreign);

			await expect(createFolder(USER_A.id, 'Nested', foreign.id)).rejects.toThrow();
		});

		it("refuses to move a folder under another user's folder", async () => {
			const foreign = makeFolder({ userId: USER_B.id });
			const mine = makeFolder({ userId: USER_A.id });
			await db.insert(folder).values([foreign, mine]);

			await expect(moveFolder(mine.id, USER_A.id, foreign.id)).rejects.toThrow();

			const [row] = await db.select().from(folder).where(eq(folder.id, mine.id));
			expect(row.parentId).toBeNull();
		});

		it("refuses to create a file under another user's folder", async () => {
			const foreign = makeFolder({ userId: USER_B.id });
			await db.insert(folder).values(foreign);

			await expect(createSpreadsheetFile(USER_A.id, 'Sheet', {}, foreign.id)).rejects.toThrow();
			await expect(createMarkdownFile(USER_A.id, 'Doc', '', foreign.id)).rejects.toThrow();
		});

		it("still allows the caller's own folder as a destination", async () => {
			const mine = makeFolder({ userId: USER_A.id });
			await db.insert(folder).values(mine);
			const f = makeFile({ userId: USER_A.id });
			await db.insert(file).values(f);

			const moved = await moveFile(f.id, USER_A.id, mine.id);
			expect(moved?.folderId).toBe(mine.id);
		});

		it('still allows null (root) as a destination', async () => {
			const mine = makeFolder({ userId: USER_A.id });
			await db.insert(folder).values(mine);
			const f = makeFile({ userId: USER_A.id, folderId: mine.id });
			await db.insert(file).values(f);

			const moved = await moveFile(f.id, USER_A.id, null);
			expect(moved?.folderId).toBeNull();
		});
	});
});
