import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { user } from '$lib/server/db/schema/auth/_better-auth';
import { assetFolder } from '$lib/server/db/schema/blog';
import {
	FolderCycleError,
	FolderNameConflictError,
	FolderNotEmptyError,
	FolderNotFoundError,
} from '$lib/server/db/shared/folder-tree';
import { makeUser } from '$lib/server/test/fixtures';

let testClient: PGlite;

vi.mock('$lib/server/db', async () => {
	const { createTestDb } = await import('$lib/server/test/db');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

const { createAssetFolder, renameAssetFolder, moveAssetFolder, deleteAssetFolder } = await import('./asset-folders');
const { db } = await import('$lib/server/db');

const USER_A = makeUser({ id: 'user-a' });
const USER_B = makeUser({ id: 'user-b' });

describe('blog asset-folders', () => {
	beforeAll(async () => {
		await db.insert(user).values([USER_A, USER_B]);
	});

	afterAll(async () => {
		await testClient?.close();
	});

	beforeEach(async () => {
		await db.delete(assetFolder);
	});

	describe('moveAssetFolder', () => {
		it('throws FolderCycleError when moving into an own descendant', async () => {
			const a = await createAssetFolder(USER_A.id, 'A');
			const b = await createAssetFolder(USER_A.id, 'B', a.id);
			const c = await createAssetFolder(USER_A.id, 'C', b.id);

			await expect(moveAssetFolder(a.id, USER_A.id, c.id)).rejects.toBeInstanceOf(FolderCycleError);
		});

		it('throws FolderNameConflictError on sibling collision at destination', async () => {
			const parent = await createAssetFolder(USER_A.id, 'Parent');
			await createAssetFolder(USER_A.id, 'Docs', parent.id);
			const loose = await createAssetFolder(USER_A.id, 'Docs');

			await expect(moveAssetFolder(loose.id, USER_A.id, parent.id)).rejects.toBeInstanceOf(FolderNameConflictError);
		});

		it('scopes by user — other users cannot move', async () => {
			const f = await createAssetFolder(USER_A.id, 'A');
			await expect(moveAssetFolder(f.id, USER_B.id, null)).rejects.toBeInstanceOf(FolderNotFoundError);
		});
	});

	describe('renameAssetFolder', () => {
		it('throws FolderNameConflictError when sibling already has that name', async () => {
			await createAssetFolder(USER_A.id, 'Existing');
			const other = await createAssetFolder(USER_A.id, 'Other');

			await expect(renameAssetFolder(other.id, USER_A.id, 'Existing')).rejects.toBeInstanceOf(FolderNameConflictError);
		});
	});

	describe('deleteAssetFolder', () => {
		it('throws FolderNotEmptyError when folder has children and recursive is false', async () => {
			const parent = await createAssetFolder(USER_A.id, 'Parent');
			await createAssetFolder(USER_A.id, 'Child', parent.id);

			await expect(deleteAssetFolder(parent.id, USER_A.id)).rejects.toBeInstanceOf(FolderNotEmptyError);

			const [check] = await db.select().from(assetFolder).where(eq(assetFolder.id, parent.id));
			expect(check).toBeDefined();
		});

		it('recursively deletes a 3-level tree and reports every deleted id', async () => {
			const a = await createAssetFolder(USER_A.id, 'A');
			const b = await createAssetFolder(USER_A.id, 'B', a.id);
			const c = await createAssetFolder(USER_A.id, 'C', b.id);

			const result = await deleteAssetFolder(a.id, USER_A.id, { recursive: true });

			expect(result.deletedIds).toHaveLength(3);
			expect(new Set(result.deletedIds)).toEqual(new Set([a.id, b.id, c.id]));

			const remaining = await db.select().from(assetFolder).where(eq(assetFolder.userId, USER_A.id));
			expect(remaining).toHaveLength(0);
		});
	});
});
