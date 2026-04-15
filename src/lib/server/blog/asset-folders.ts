/**
 * BLOG ASSET-FOLDER mutations + queries — mirror of post-folders.ts scoped to
 * the `blog.asset_folder` table. Uses the shared cycle-check helpers and typed
 * errors for cross-domain consistency.
 *
 * Uploader vs user: `blog.asset.uploader_id` is nullable (assets survive user
 * deletion). But folder ownership is per-user, auth-scoped via the same
 * `requireApiAuthor` as the rest of the blog surface — a folder with a null
 * user would have nowhere to live, so the column stays NOT NULL and cascades
 * on user deletion. Orphaned assets (after uploader delete) lose their
 * `folder_id` via the asset.folder_id `SET NULL` FK.
 */
import { and, count, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { createId } from '$lib/server/db/id';
import { asset, assetFolder } from '$lib/server/db/schema/blog';
import {
	collectSubtreeIds,
	FolderCycleError,
	FolderNameConflictError,
	FolderNotEmptyError,
	FolderNotFoundError,
	isCycleMove,
	isUniqueViolation,
	suggestNextName,
} from '$lib/server/db/shared/folder-tree';

export const ASSET_FOLDER_LIST_CAP = 500;

/** Get a single asset folder scoped by user. Returns null when not found. */
export async function getAssetFolder(id: string, userId: string) {
	const [row] = await db
		.select()
		.from(assetFolder)
		.where(and(eq(assetFolder.id, id), eq(assetFolder.userId, userId)))
		.limit(1);
	return row ?? null;
}

export async function listAssetFolders(userId: string) {
	const items = await db
		.select({
			id: assetFolder.id,
			parentId: assetFolder.parentId,
			name: assetFolder.name,
			createdAt: assetFolder.createdAt,
			updatedAt: assetFolder.updatedAt,
		})
		.from(assetFolder)
		.where(eq(assetFolder.userId, userId))
		.orderBy(sql`${assetFolder.parentId} NULLS FIRST`, assetFolder.name)
		.limit(ASSET_FOLDER_LIST_CAP + 1);
	return {
		items: items.slice(0, ASSET_FOLDER_LIST_CAP),
		overflow: items.length > ASSET_FOLDER_LIST_CAP,
	};
}

export async function createAssetFolder(userId: string, name = 'New Folder', parentId: string | null = null) {
	try {
		const [row] = await db
			.insert(assetFolder)
			.values({ id: createId.assetFolder(), userId, parentId, name })
			.returning();
		return row;
	} catch (e) {
		if (isUniqueViolation(e)) throw new FolderNameConflictError(parentId, name, suggestNextName(name));
		throw e;
	}
}

export async function renameAssetFolder(id: string, userId: string, name: string) {
	try {
		const [row] = await db
			.update(assetFolder)
			.set({ name, updatedAt: new Date() })
			.where(and(eq(assetFolder.id, id), eq(assetFolder.userId, userId)))
			.returning();
		if (!row) throw new FolderNotFoundError(id);
		return row;
	} catch (e) {
		if (isUniqueViolation(e)) {
			const [row] = await db
				.select({ parentId: assetFolder.parentId })
				.from(assetFolder)
				.where(and(eq(assetFolder.id, id), eq(assetFolder.userId, userId)))
				.limit(1);
			throw new FolderNameConflictError(row?.parentId ?? null, name, suggestNextName(name));
		}
		throw e;
	}
}

export async function moveAssetFolder(id: string, userId: string, parentId: string | null) {
	const [target] = await db
		.select()
		.from(assetFolder)
		.where(and(eq(assetFolder.id, id), eq(assetFolder.userId, userId)))
		.limit(1);
	if (!target) throw new FolderNotFoundError(id);

	if (parentId && (await isCycleMove(db, assetFolder, id, parentId, userId))) {
		throw new FolderCycleError(id, parentId);
	}

	try {
		const [row] = await db
			.update(assetFolder)
			.set({ parentId, updatedAt: new Date() })
			.where(and(eq(assetFolder.id, id), eq(assetFolder.userId, userId)))
			.returning();
		if (!row) throw new FolderNotFoundError(id);
		return row;
	} catch (e) {
		if (isUniqueViolation(e)) throw new FolderNameConflictError(parentId, target.name, suggestNextName(target.name));
		throw e;
	}
}

export async function deleteAssetFolder(
	id: string,
	userId: string,
	options: { recursive?: boolean } = {},
): Promise<{ id: string; name: string; deletedIds: string[] }> {
	const { recursive = false } = options;

	const [target] = await db
		.select()
		.from(assetFolder)
		.where(and(eq(assetFolder.id, id), eq(assetFolder.userId, userId)))
		.limit(1);
	if (!target) throw new FolderNotFoundError(id);

	if (!recursive) {
		const [sub] = await db
			.select({ n: count() })
			.from(assetFolder)
			.where(and(eq(assetFolder.parentId, id), eq(assetFolder.userId, userId)));
		const [assets] = await db
			.select({ n: count() })
			.from(asset)
			.where(and(eq(asset.folderId, id), eq(asset.uploaderId, userId)));
		const total = (sub?.n ?? 0) + (assets?.n ?? 0);
		if (total > 0) throw new FolderNotEmptyError(id, total);

		const [row] = await db
			.delete(assetFolder)
			.where(and(eq(assetFolder.id, id), eq(assetFolder.userId, userId)))
			.returning();
		if (!row) throw new FolderNotFoundError(id);
		return { id: row.id, name: row.name, deletedIds: [row.id] };
	}

	const deletedIds = await collectSubtreeIds(db, assetFolder, id, userId);

	const [row] = await db
		.delete(assetFolder)
		.where(and(eq(assetFolder.id, id), eq(assetFolder.userId, userId)))
		.returning();
	if (!row) throw new FolderNotFoundError(id);
	return { id: row.id, name: row.name, deletedIds };
}
