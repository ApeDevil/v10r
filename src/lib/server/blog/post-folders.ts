/**
 * BLOG POST-FOLDER mutations + queries — mirror of desk/mutations.ts folder ops
 * scoped to the `blog.post_folder` table. Uses the shared cycle-check CTE and
 * typed errors so error handling, audit trails, and client error mapping stay
 * consistent across all three nestable domains.
 */
import { and, count, eq, isNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { createId } from '$lib/server/db/id';
import { post, postFolder } from '$lib/server/db/schema/blog';
import {
	assertOwnedDestination,
	collectSubtreeIds,
	FolderCycleError,
	FolderNameConflictError,
	FolderNotEmptyError,
	FolderNotFoundError,
	isCycleMove,
	isUniqueViolation,
	lockFolderTree,
	suggestNextName,
} from '$lib/server/db/shared/folder-tree';

/** Hard cap on folders returned by `listPostFolders`. Matches desk. */
export const POST_FOLDER_LIST_CAP = 500;

/** Get a single post folder scoped by user. Returns null when not found. */
export async function getPostFolder(id: string, userId: string) {
	const [row] = await db
		.select()
		.from(postFolder)
		.where(and(eq(postFolder.id, id), eq(postFolder.userId, userId)))
		.limit(1);
	return row ?? null;
}

/**
 * List all post folders for a user (flat). Client builds the tree in one pass.
 * Unpaginated — a paginated tree is unrenderable. Capped for safety.
 */
export async function listPostFolders(userId: string) {
	const items = await db
		.select({
			id: postFolder.id,
			parentId: postFolder.parentId,
			name: postFolder.name,
			createdAt: postFolder.createdAt,
			updatedAt: postFolder.updatedAt,
		})
		.from(postFolder)
		.where(eq(postFolder.userId, userId))
		.orderBy(sql`${postFolder.parentId} NULLS FIRST`, postFolder.name)
		.limit(POST_FOLDER_LIST_CAP + 1);
	return {
		items: items.slice(0, POST_FOLDER_LIST_CAP),
		overflow: items.length > POST_FOLDER_LIST_CAP,
	};
}

/** Create a new post folder. @throws FolderNameConflictError on sibling collision. */
export async function createPostFolder(userId: string, name = 'New Folder', parentId: string | null = null) {
	await assertOwnedDestination(db, postFolder, parentId, userId);
	try {
		const [row] = await db.insert(postFolder).values({ id: createId.postFolder(), userId, parentId, name }).returning();
		return row;
	} catch (e) {
		if (isUniqueViolation(e)) throw new FolderNameConflictError(parentId, name, suggestNextName(name));
		throw e;
	}
}

/**
 * Rename a post folder.
 * @throws FolderNotFoundError when the row doesn't exist.
 * @throws FolderNameConflictError on sibling name collision.
 */
export async function renamePostFolder(id: string, userId: string, name: string) {
	try {
		const [row] = await db
			.update(postFolder)
			.set({ name, updatedAt: new Date() })
			.where(and(eq(postFolder.id, id), eq(postFolder.userId, userId)))
			.returning();
		if (!row) throw new FolderNotFoundError(id);
		return row;
	} catch (e) {
		if (isUniqueViolation(e)) {
			const [row] = await db
				.select({ parentId: postFolder.parentId })
				.from(postFolder)
				.where(and(eq(postFolder.id, id), eq(postFolder.userId, userId)))
				.limit(1);
			throw new FolderNameConflictError(row?.parentId ?? null, name, suggestNextName(name));
		}
		throw e;
	}
}

/**
 * Move a post folder to a new parent. Validates no cycle via recursive CTE walk.
 * @throws FolderNotFoundError, FolderCycleError, FolderNameConflictError.
 */
export async function movePostFolder(id: string, userId: string, parentId: string | null) {
	return db.transaction(async (tx) => {
		// Before the first read, not between the check and the write: the cycle check
		// answers a question a concurrent move can invalidate. See lockFolderTree.
		await lockFolderTree(tx, postFolder, userId);

		const [target] = await tx
			.select()
			.from(postFolder)
			.where(and(eq(postFolder.id, id), eq(postFolder.userId, userId)))
			.limit(1);
		if (!target) throw new FolderNotFoundError(id);

		// Destination ownership — isCycleMove's user-scoped seed silently reports
		// "no cycle" for a foreign parent rather than rejecting it.
		await assertOwnedDestination(tx, postFolder, parentId, userId);

		if (parentId && (await isCycleMove(tx, postFolder, id, parentId, userId))) {
			throw new FolderCycleError(id, parentId);
		}

		try {
			const [row] = await tx
				.update(postFolder)
				.set({ parentId, updatedAt: new Date() })
				.where(and(eq(postFolder.id, id), eq(postFolder.userId, userId)))
				.returning();
			if (!row) throw new FolderNotFoundError(id);
			return row;
		} catch (e) {
			if (isUniqueViolation(e)) throw new FolderNameConflictError(parentId, target.name, suggestNextName(target.name));
			throw e;
		}
	});
}

/**
 * Delete a post folder. Default non-recursive: throws `FolderNotEmptyError` if
 * the folder contains any child folder or non-soft-deleted post. Pass
 * `{ recursive: true }` to cascade — the self-FK cascade handles descendant
 * folders; posts under deleted folders are orphaned to root via `SET NULL`.
 */
export async function deletePostFolder(
	id: string,
	userId: string,
	options: { recursive?: boolean } = {},
): Promise<{ id: string; name: string; deletedIds: string[] }> {
	const { recursive = false } = options;

	return db.transaction(async (tx) => {
		// Both branches read the tree and then act on what they read: "is it empty"
		// and "which ids am I about to cascade away" are stale the moment a
		// concurrent move lands. See lockFolderTree.
		await lockFolderTree(tx, postFolder, userId);

		const [target] = await tx
			.select()
			.from(postFolder)
			.where(and(eq(postFolder.id, id), eq(postFolder.userId, userId)))
			.limit(1);
		if (!target) throw new FolderNotFoundError(id);

		if (!recursive) {
			const [sub] = await tx
				.select({ n: count() })
				.from(postFolder)
				.where(and(eq(postFolder.parentId, id), eq(postFolder.userId, userId)));
			const [posts] = await tx
				.select({ n: count() })
				.from(post)
				.where(and(eq(post.folderId, id), eq(post.authorId, userId), isNull(post.deletedAt)));
			const total = (sub?.n ?? 0) + (posts?.n ?? 0);
			if (total > 0) throw new FolderNotEmptyError(id, total);

			const [row] = await tx
				.delete(postFolder)
				.where(and(eq(postFolder.id, id), eq(postFolder.userId, userId)))
				.returning();
			if (!row) throw new FolderNotFoundError(id);
			return { id: row.id, name: row.name, deletedIds: [row.id] };
		}

		const deletedIds = await collectSubtreeIds(tx, postFolder, id, userId);

		const [row] = await tx
			.delete(postFolder)
			.where(and(eq(postFolder.id, id), eq(postFolder.userId, userId)))
			.returning();
		if (!row) throw new FolderNotFoundError(id);
		return { id: row.id, name: row.name, deletedIds };
	});
}
