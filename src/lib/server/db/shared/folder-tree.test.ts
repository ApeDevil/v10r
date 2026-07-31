/**
 * FOLDER-TREE PRIMITIVES — cycle, subtree, and cross-tenant guards on real PGlite.
 *
 * These three helpers are security guards (their docblocks record real prior
 * cross-tenant bugs), and they were untestable until they read driver results
 * through `rowsOf()`: raw `.rows` access is prod-correct on neon-serverless but
 * undefined on pglite, which silently turned cycle detection OFF under test.
 * This suite pins the rowsOf routing as much as the guard semantics.
 */
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { user } from '$lib/server/db/schema/auth/_better-auth';
import { postFolder } from '$lib/server/db/schema/blog/post-folder';
import { assertOwnedDestination, collectSubtreeIds, FolderNotFoundError, isCycleMove } from './folder-tree';

let testClient: PGlite;

vi.mock('$lib/server/db', async () => {
	const { createTestDb } = await import('$lib/server/test/db');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

const { db } = await import('$lib/server/db');

afterAll(async () => {
	await testClient?.close();
});

const USER_A = 'usr_tree_a';
const USER_B = 'usr_tree_b';

beforeEach(async () => {
	await db.delete(user);
	await db.insert(user).values([
		{ id: USER_A, name: 'Tree A', email: 'tree-a@example.com' },
		{ id: USER_B, name: 'Tree B', email: 'tree-b@example.com' },
	]);
	// A's chain: root → child → grandchild; plus an unrelated sibling.
	await db.insert(postFolder).values([
		{ id: 'f_root', userId: USER_A, parentId: null, name: 'root' },
		{ id: 'f_child', userId: USER_A, parentId: 'f_root', name: 'child' },
		{ id: 'f_grand', userId: USER_A, parentId: 'f_child', name: 'grand' },
		{ id: 'f_sibling', userId: USER_A, parentId: null, name: 'sibling' },
	]);
	// B's folder parented under A's chain — the cross-tenant state the guards
	// exist to contain (raw insert simulates the pre-guard bug).
	await db.insert(postFolder).values([{ id: 'f_foreign', userId: USER_B, parentId: 'f_child', name: 'foreign' }]);
});

describe('isCycleMove', () => {
	it('detects moving a folder under its own descendant', async () => {
		expect(await isCycleMove(db, postFolder, 'f_root', 'f_grand', USER_A)).toBe(true);
		expect(await isCycleMove(db, postFolder, 'f_root', 'f_child', USER_A)).toBe(true);
	});

	it('detects a self-move without touching the database', async () => {
		expect(await isCycleMove(db, postFolder, 'f_root', 'f_root', USER_A)).toBe(true);
	});

	it('allows a legal sibling move', async () => {
		expect(await isCycleMove(db, postFolder, 'f_sibling', 'f_grand', USER_A)).toBe(false);
		expect(await isCycleMove(db, postFolder, 'f_child', 'f_sibling', USER_A)).toBe(false);
	});
});

describe('collectSubtreeIds', () => {
	it('collects the root and every owned descendant', async () => {
		const ids = await collectSubtreeIds(db, postFolder, 'f_root', USER_A);
		expect(ids.sort()).toEqual(['f_child', 'f_grand', 'f_root']);
	});

	it('never crosses tenants — a foreign folder parented inside the tree stays out', async () => {
		const ids = await collectSubtreeIds(db, postFolder, 'f_child', USER_A);
		expect(ids.sort()).toEqual(['f_child', 'f_grand']);
		expect(ids).not.toContain('f_foreign');
	});

	it('returns empty for a folder the caller does not own', async () => {
		expect(await collectSubtreeIds(db, postFolder, 'f_root', USER_B)).toEqual([]);
	});
});

describe('assertOwnedDestination', () => {
	it('accepts the caller’s own folder and root (null)', async () => {
		await expect(assertOwnedDestination(db, postFolder, 'f_child', USER_A)).resolves.toBeUndefined();
		await expect(assertOwnedDestination(db, postFolder, null, USER_A)).resolves.toBeUndefined();
		await expect(assertOwnedDestination(db, postFolder, undefined, USER_A)).resolves.toBeUndefined();
	});

	it('rejects another user’s folder and a missing folder with the SAME error (no existence oracle)', async () => {
		const foreign = await assertOwnedDestination(db, postFolder, 'f_foreign', USER_A).catch((e) => e);
		const missing = await assertOwnedDestination(db, postFolder, 'f_nope', USER_A).catch((e) => e);
		expect(foreign).toBeInstanceOf(FolderNotFoundError);
		expect(missing).toBeInstanceOf(FolderNotFoundError);
		expect((foreign as FolderNotFoundError).code).toBe((missing as FolderNotFoundError).code);
	});
});
