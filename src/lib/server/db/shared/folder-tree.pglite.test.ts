/**
 * FOLDER-TREE PRIMITIVES — cycle, subtree, and cross-tenant guards on real PGlite.
 *
 * These helpers are security guards (their docblocks record real prior cross-tenant
 * bugs), and they were untestable until they read driver results through `rowsOf()`:
 * raw `.rows` access is prod-correct on neon-serverless but undefined on pglite, which
 * silently turned cycle detection OFF under test. This suite pins the rowsOf routing as
 * much as the guard semantics.
 *
 * WHAT THIS LANE CANNOT PROVE. `lockFolderTree` exists to make two *concurrent*
 * transactions take turns, and PGlite is a single connection — a second transaction has
 * nothing to run on, and a read issued through the pool while one is open deadlocks
 * against it. So these tests pin the lock's mechanics (acquired, scoped, re-entrant,
 * released on both exits) and `folder-tree.gate.test.ts` pins that every guarded
 * mutation takes it before its first read. Contention itself needs two connections to a
 * real Postgres, and is unverified here.
 */
import type { PGlite } from '@electric-sql/pglite';
import { type SQL, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { rowsOf } from '$lib/server/db/rows';
import { user } from '$lib/server/db/schema/auth/_better-auth';
import { assetFolder } from '$lib/server/db/schema/blog/asset-folder';
import { postFolder } from '$lib/server/db/schema/blog/post-folder';
import {
	assertOwnedDestination,
	collectSubtreeIds,
	FolderNotFoundError,
	isCycleMove,
	lockFolderTree,
} from './folder-tree';

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

describe('lockFolderTree', () => {
	/**
	 * Advisory locks Postgres is holding right now, by their (classid, objid) key pair.
	 *
	 * Takes the executor rather than reaching for `db`: PGlite is one connection, so a
	 * read issued through the pool while a transaction is open waits for a transaction
	 * that is waiting for the read. That single connection is also why contention itself
	 * is out of reach here — see the suite header.
	 */
	async function heldKeys(exec: { execute: (q: SQL) => Promise<unknown> }): Promise<string[]> {
		const rows = rowsOf<{ classid: number; objid: number }>(
			await exec.execute(sql`SELECT classid, objid FROM pg_locks WHERE locktype = 'advisory'`),
		);
		return rows.map((r) => `${r.classid}:${r.objid}`).sort();
	}

	it('holds a lock for the duration of the transaction and releases it on commit', async () => {
		const inside = await db.transaction(async (tx) => {
			await lockFolderTree(tx, postFolder, USER_A);
			return heldKeys(tx);
		});
		expect(inside).toHaveLength(1);
		// There is no unlock call, so commit is the only thing that frees the tree.
		expect(await heldKeys(db)).toEqual([]);
	});

	it('releases the lock when the transaction rolls back', async () => {
		await expect(
			db.transaction(async (tx) => {
				await lockFolderTree(tx, postFolder, USER_A);
				throw new FolderNotFoundError('f_nope');
			}),
		).rejects.toBeInstanceOf(FolderNotFoundError);
		// A move that throws FolderCycleError must not strand the tree.
		expect(await heldKeys(db)).toEqual([]);
	});

	it('is re-entrant, so nesting guarded operations cannot self-deadlock', async () => {
		await db.transaction(async (tx) => {
			await lockFolderTree(tx, postFolder, USER_A);
			await expect(lockFolderTree(tx, postFolder, USER_A)).resolves.toBeUndefined();
		});
	});

	it("keys on the owner, so one user's tree never waits on another's", async () => {
		const keys = await db.transaction(async (tx) => {
			await lockFolderTree(tx, postFolder, USER_A);
			await lockFolderTree(tx, postFolder, USER_B);
			return heldKeys(tx);
		});
		expect(keys).toHaveLength(2);
	});

	it('keys on the table, so the blog and desk trees never wait on each other', async () => {
		const keys = await db.transaction(async (tx) => {
			await lockFolderTree(tx, postFolder, USER_A);
			await lockFolderTree(tx, assetFolder, USER_A);
			return heldKeys(tx);
		});
		expect(keys).toHaveLength(2);
	});
});
