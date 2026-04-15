/**
 * FOLDER-TREE PRIMITIVES — shared across all nestable content domains.
 *
 * Every folder-bearing domain (desk, blog posts, blog assets) needs:
 * - the same typed errors so one client error matrix covers all three surfaces
 * - the same cycle-check CTE, parameterized by table
 * - the same PG unique-violation detection for name conflicts
 *
 * The cycle check walks `parent_id` upward from a candidate new parent, scoped
 * by `user_id`, and returns whether the folder being moved appears in its own
 * ancestor chain. Mirrors the server-side recursion, not the client `isCycleMove`.
 */
import { sql, type SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';

// ── Typed errors ──────────────────────────────────────────────────

export class FolderNotFoundError extends Error {
	readonly code = 'folder_not_found' as const;
	constructor(public folderId: string) {
		super(`Folder ${folderId} not found.`);
		this.name = 'FolderNotFoundError';
	}
}

export class FolderNameConflictError extends Error {
	readonly code = 'folder_name_conflict' as const;
	constructor(
		public parentId: string | null,
		public name: string,
		public suggestedName: string,
	) {
		super(`A folder named "${name}" already exists in the target parent.`);
		this.name = 'FolderNameConflictError';
	}
}

export class FolderCycleError extends Error {
	readonly code = 'folder_cycle' as const;
	constructor(
		public folderId: string,
		public targetParentId: string,
	) {
		super('Cannot move a folder into itself or one of its descendants.');
		this.name = 'FolderCycleError';
	}
}

export class FolderNotEmptyError extends Error {
	readonly code = 'folder_not_empty' as const;
	constructor(
		public folderId: string,
		public childCount: number,
	) {
		super(`Folder contains ${childCount} item(s).`);
		this.name = 'FolderNotEmptyError';
	}
}

// ── Postgres error detection ──────────────────────────────────────

/** Postgres unique-violation SQLSTATE. */
export const PG_UNIQUE_VIOLATION = '23505';

/**
 * Drizzle wraps driver errors in `DrizzleQueryError`, exposing the original via
 * `.cause`. Walk the cause chain up to a reasonable depth to handle nested
 * wrappers from future middleware.
 */
export function isUniqueViolation(e: unknown): boolean {
	let current: unknown = e;
	for (let depth = 0; depth < 5 && current; depth++) {
		if (typeof current === 'object' && current !== null) {
			const code = (current as { code?: unknown }).code;
			if (code === PG_UNIQUE_VIOLATION) return true;
			current = (current as { cause?: unknown }).cause;
		} else {
			break;
		}
	}
	return false;
}

// ── Name suggestion ───────────────────────────────────────────────

/** "Foo" → "Foo (2)", "Foo (2)" → "Foo (3)". Used in name-conflict error payloads. */
export function suggestNextName(name: string): string {
	const m = name.match(/^(.*) \((\d+)\)$/);
	if (m) return `${m[1]} (${Number.parseInt(m[2], 10) + 1})`;
	return `${name} (2)`;
}

// ── Cycle-check CTE ───────────────────────────────────────────────

/**
 * Run the ancestor-walk cycle check against an arbitrary folder table.
 *
 * Returns `true` when moving `folderId` under `targetParentId` would create a
 * cycle — i.e. the target is the folder itself or any of its descendants.
 *
 * Why a helper: desk, blog-post, and blog-asset folders each live in their own
 * table with narrow FKs; without this, each domain would hand-maintain its own
 * recursive CTE and they would drift.
 */
export async function isCycleMove(
	dbExec: { execute: (q: SQL) => Promise<unknown> },
	table: PgTable,
	folderId: string,
	targetParentId: string,
	userId: string,
): Promise<boolean> {
	if (folderId === targetParentId) return true;
	const result = await dbExec.execute(sql`
		WITH RECURSIVE ancestors AS (
			SELECT id, parent_id FROM ${table} WHERE id = ${targetParentId} AND user_id = ${userId}
			UNION ALL
			SELECT f.id, f.parent_id FROM ${table} f JOIN ancestors a ON f.id = a.parent_id
		)
		SELECT EXISTS(SELECT 1 FROM ancestors WHERE id = ${folderId}) AS is_cycle
	`);
	return (result as { rows?: { is_cycle: boolean }[] }).rows?.[0]?.is_cycle === true;
}

/**
 * Collect every descendant id in the subtree rooted at `folderId`, including
 * the root itself. Used by recursive delete for audit-log / Neo4j sync.
 */
export async function collectSubtreeIds(
	dbExec: { execute: (q: SQL) => Promise<unknown> },
	table: PgTable,
	folderId: string,
	userId: string,
): Promise<string[]> {
	const result = await dbExec.execute(sql`
		WITH RECURSIVE subtree AS (
			SELECT id FROM ${table} WHERE id = ${folderId} AND user_id = ${userId}
			UNION ALL
			SELECT f.id FROM ${table} f JOIN subtree s ON f.parent_id = s.id
		)
		SELECT id FROM subtree
	`);
	return (result as { rows?: { id: string }[] }).rows?.map((r) => r.id) ?? [];
}
