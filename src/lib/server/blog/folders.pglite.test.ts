/**
 * Folder-tree semantics for BOTH blog folder kinds.
 *
 * `post-folders.ts` and `asset-folders.ts` are the same tree operations over two
 * tables, and their suites were byte-identical modulo the words "post"/"asset" —
 * two files, two full PGlite schema pushes, one set of guarantees. Parameterising
 * over the pair keeps every assertion and makes a divergence between the two
 * surfaces impossible to introduce silently: a rule added here is a rule for both.
 */
import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { user } from '$lib/server/db/schema/auth/_better-auth';
import { assetFolder, postFolder } from '$lib/server/db/schema/blog';
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

const posts = await import('./post-folders');
const assets = await import('./asset-folders');
const { db } = await import('$lib/server/db');

const USER_A = makeUser({ id: 'user-a' });
const USER_B = makeUser({ id: 'user-b' });

const KINDS = [
	{
		kind: 'post',
		table: postFolder,
		create: posts.createPostFolder,
		rename: posts.renamePostFolder,
		move: posts.movePostFolder,
		remove: posts.deletePostFolder,
	},
	{
		kind: 'asset',
		table: assetFolder,
		create: assets.createAssetFolder,
		rename: assets.renameAssetFolder,
		move: assets.moveAssetFolder,
		remove: assets.deleteAssetFolder,
	},
] as const;

describe('blog folders', () => {
	beforeAll(async () => {
		await db.insert(user).values([USER_A, USER_B]);
	});

	afterAll(async () => {
		await testClient?.close();
	});

	beforeEach(async () => {
		await db.delete(postFolder);
		await db.delete(assetFolder);
	});

	describe.each(KINDS)('$kind folders', ({ table, create, rename, move, remove }) => {
		describe('move', () => {
			it('throws FolderCycleError when moving into an own descendant', async () => {
				const a = await create(USER_A.id, 'A');
				const b = await create(USER_A.id, 'B', a.id);
				const c = await create(USER_A.id, 'C', b.id);

				await expect(move(a.id, USER_A.id, c.id)).rejects.toBeInstanceOf(FolderCycleError);
			});

			it('throws FolderNameConflictError on sibling collision at destination', async () => {
				const parent = await create(USER_A.id, 'Parent');
				await create(USER_A.id, 'Docs', parent.id);
				const loose = await create(USER_A.id, 'Docs');

				await expect(move(loose.id, USER_A.id, parent.id)).rejects.toBeInstanceOf(FolderNameConflictError);
			});

			it('scopes by user — other users cannot move', async () => {
				const f = await create(USER_A.id, 'A');
				await expect(move(f.id, USER_B.id, null)).rejects.toBeInstanceOf(FolderNotFoundError);
			});
		});

		describe('rename', () => {
			it('throws FolderNameConflictError when sibling already has that name', async () => {
				await create(USER_A.id, 'Existing');
				const other = await create(USER_A.id, 'Other');

				await expect(rename(other.id, USER_A.id, 'Existing')).rejects.toBeInstanceOf(FolderNameConflictError);
			});
		});

		describe('delete', () => {
			it('throws FolderNotEmptyError when folder has children and recursive is false', async () => {
				const parent = await create(USER_A.id, 'Parent');
				await create(USER_A.id, 'Child', parent.id);

				await expect(remove(parent.id, USER_A.id)).rejects.toBeInstanceOf(FolderNotEmptyError);

				const [check] = await db.select().from(table).where(eq(table.id, parent.id));
				expect(check).toBeDefined();
			});

			it('recursively deletes a 3-level tree and reports every deleted id', async () => {
				const a = await create(USER_A.id, 'A');
				const b = await create(USER_A.id, 'B', a.id);
				const c = await create(USER_A.id, 'C', b.id);

				const result = await remove(a.id, USER_A.id, { recursive: true });

				expect(result.deletedIds).toHaveLength(3);
				expect(new Set(result.deletedIds)).toEqual(new Set([a.id, b.id, c.id]));

				const remaining = await db.select().from(table).where(eq(table.userId, USER_A.id));
				expect(remaining).toHaveLength(0);
			});
		});
	});
});
