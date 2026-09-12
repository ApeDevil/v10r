import { and, eq, isNull, like, sql } from 'drizzle-orm';
import { recalculateCells, type SpreadsheetCells } from '$lib/desk/spreadsheet-cells';
import { createId } from '../id';
import { type DbHandle, db } from '../index';
import { file, fileRevision, folder, markdown, spreadsheet } from '../schema/desk';

/** Who triggered a recoverable content mutation. Threaded into the pre-image snapshot. */
export type RevisionSource = 'ai' | 'user';

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
} from '../shared/folder-tree';

/**
 * Create a new spreadsheet file (file + spreadsheet in a transaction).
 *
 * `originToolCallId` threads the creator agent action through for blast-radius
 * queries ("which files did this tool call produce?"). NULL for human creates.
 *
 * Cells are stored re-derived: the sheet has writers with no grid (the AI tools), and
 * the value they hand over is only what the sheet would show if every input agrees.
 */
export async function createSpreadsheetFile(
	userId: string,
	name = 'Untitled',
	cells: SpreadsheetCells = {},
	folderId: string | null = null,
	originToolCallId: string | null = null,
	handle: DbHandle = db,
) {
	const stored = recalculateCells(cells);
	return handle.transaction(async (tx) => {
		await assertOwnedDestination(tx, folder, folderId, userId);
		const fileId = createId.file();
		const [fileRow] = await tx
			.insert(file)
			.values({ id: fileId, userId, type: 'spreadsheet', name, folderId, originToolCallId })
			.returning();
		const [sheetRow] = await tx
			.insert(spreadsheet)
			.values({ id: createId.spreadsheet(), fileId, userId, name, cells: stored })
			.returning();
		return { file: fileRow, spreadsheet: sheetRow };
	});
}

/** Rename a file. Skips soft-deleted rows. */
export async function renameFile(id: string, userId: string, name: string, handle: DbHandle = db) {
	const [row] = await handle
		.update(file)
		.set({ name, updatedAt: new Date() })
		.where(and(eq(file.id, id), eq(file.userId, userId), isNull(file.deletedAt)))
		.returning();
	return row ?? null;
}

/**
 * Soft-delete a file.
 *
 * Sets `deleted_at` on the file row and on the matching detail row
 * (spreadsheet or markdown). Readers filter `deleted_at IS NULL` so the
 * file disappears from every list, tree, and AI tool. There is no restore
 * path — the row stays in place until the `deskRetention` job hard-deletes
 * it after the `desk-trash` retention window.
 */
export async function deleteFile(id: string, userId: string, source: RevisionSource = 'user', handle: DbHandle = db) {
	return handle.transaction(async (tx) => {
		const now = new Date();
		const [fileRow] = await tx
			.update(file)
			.set({ deletedAt: now, updatedAt: now })
			.where(and(eq(file.id, id), eq(file.userId, userId), isNull(file.deletedAt)))
			.returning();
		if (!fileRow) return null;

		// Snapshot the detail content as a `delete` pre-image, then soft-delete the matching
		// detail row so the `isNull(...deletedAt)` guards in joined queries exclude it too.
		// The revision has no FK to the file, so it outlives a later hard retention sweep.
		if (fileRow.type === 'spreadsheet') {
			const [current] = await tx
				.select({ cells: spreadsheet.cells, columnMeta: spreadsheet.columnMeta })
				.from(spreadsheet)
				.where(eq(spreadsheet.fileId, id))
				.limit(1);
			if (current) {
				await tx.insert(fileRevision).values({
					id: createId.deskRevision(),
					fileId: id,
					userId,
					fileType: 'spreadsheet',
					cells: current.cells,
					columnMeta: current.columnMeta ?? null,
					source,
					reason: 'delete',
				});
			}
			await tx.update(spreadsheet).set({ deletedAt: now }).where(eq(spreadsheet.fileId, id));
		} else if (fileRow.type === 'markdown') {
			const [current] = await tx
				.select({ content: markdown.content })
				.from(markdown)
				.where(eq(markdown.fileId, id))
				.limit(1);
			if (current) {
				await tx.insert(fileRevision).values({
					id: createId.deskRevision(),
					fileId: id,
					userId,
					fileType: 'markdown',
					content: current.content,
					source,
					reason: 'delete',
				});
			}
			await tx.update(markdown).set({ deletedAt: now }).where(eq(markdown.fileId, id));
		}
		return fileRow;
	});
}

/** Move a file to a folder (or root if folderId is null). Skips soft-deleted. */
export async function moveFile(id: string, userId: string, folderId: string | null) {
	// The WHERE clause proves the FILE is the caller's; it says nothing about the
	// destination folder. Without this the file could be parented into another
	// user's tree.
	await assertOwnedDestination(db, folder, folderId, userId);
	const [row] = await db
		.update(file)
		.set({ folderId, updatedAt: new Date() })
		.where(and(eq(file.id, id), eq(file.userId, userId), isNull(file.deletedAt)))
		.returning();
	return row ?? null;
}

/** Toggle AI context flag on a file. Skips soft-deleted. */
export async function toggleFileAiContext(id: string, userId: string, aiContext: boolean) {
	const [row] = await db
		.update(file)
		.set({ aiContext, updatedAt: new Date() })
		.where(and(eq(file.id, id), eq(file.userId, userId), isNull(file.deletedAt)))
		.returning();
	return row ?? null;
}

/** Duplicate a spreadsheet file. Generates "X copy", "X copy 2", etc. Skips soft-deleted source. */
export async function duplicateSpreadsheetFile(id: string, userId: string) {
	const [original] = await db
		.select()
		.from(file)
		.where(and(eq(file.id, id), eq(file.userId, userId), isNull(file.deletedAt)))
		.limit(1);
	if (!original) return null;

	const [originalSheet] = await db
		.select()
		.from(spreadsheet)
		.where(and(eq(spreadsheet.fileId, id), isNull(spreadsheet.deletedAt)))
		.limit(1);

	const baseName = original.name;
	const copyPattern = `${baseName} copy%`;
	const existing = await db
		.select({ name: file.name })
		.from(file)
		.where(and(eq(file.userId, userId), like(file.name, copyPattern), isNull(file.deletedAt)));

	let dupName = `${baseName} copy`;
	if (existing.some((r) => r.name === dupName)) {
		const nums = existing
			.map((r) => {
				const m = r.name.match(/ copy (\d+)$/);
				return m ? Number.parseInt(m[1], 10) : 1;
			})
			.filter((n) => !Number.isNaN(n));
		const next = nums.length > 0 ? Math.max(...nums) + 1 : 2;
		dupName = `${baseName} copy ${next}`;
	}

	return db.transaction(async (tx) => {
		const fileId = createId.file();
		const [fileRow] = await tx
			.insert(file)
			.values({
				id: fileId,
				userId,
				type: original.type,
				name: dupName,
				folderId: original.folderId,
			})
			.returning();

		let sheetRow = null;
		if (originalSheet) {
			[sheetRow] = await tx
				.insert(spreadsheet)
				.values({
					id: createId.spreadsheet(),
					fileId,
					userId,
					name: dupName,
					cells: originalSheet.cells ?? {},
					columnMeta: originalSheet.columnMeta,
				})
				.returning();
		}

		return { file: fileRow, spreadsheet: sheetRow };
	});
}

/**
 * Create a new folder.
 * @throws FolderNameConflictError when `(userId, parentId, name)` collides.
 */
export async function createFolder(userId: string, name = 'New Folder', parentId: string | null = null) {
	await assertOwnedDestination(db, folder, parentId, userId);
	try {
		const [row] = await db.insert(folder).values({ id: createId.folder(), userId, parentId, name }).returning();
		return row;
	} catch (e) {
		if (isUniqueViolation(e)) throw new FolderNameConflictError(parentId, name, suggestNextName(name));
		throw e;
	}
}

/**
 * Rename a folder.
 * @throws FolderNotFoundError when the row doesn't exist.
 * @throws FolderNameConflictError on sibling name collision.
 */
export async function renameFolder(id: string, userId: string, name: string) {
	try {
		const [row] = await db
			.update(folder)
			.set({ name, updatedAt: new Date() })
			.where(and(eq(folder.id, id), eq(folder.userId, userId)))
			.returning();
		if (!row) throw new FolderNotFoundError(id);
		return row;
	} catch (e) {
		if (isUniqueViolation(e)) {
			// Need parentId for the suggested name context — look it up.
			const [row] = await db
				.select({ parentId: folder.parentId })
				.from(folder)
				.where(and(eq(folder.id, id), eq(folder.userId, userId)))
				.limit(1);
			throw new FolderNameConflictError(row?.parentId ?? null, name, suggestNextName(name));
		}
		throw e;
	}
}

/**
 * Move a folder to a new parent. Validates no cycle via recursive CTE walk.
 * @throws FolderNotFoundError when the row doesn't exist.
 * @throws FolderCycleError when `parentId` is `id` or any descendant.
 * @throws FolderNameConflictError on sibling name collision at the new parent.
 */
export async function moveFolder(id: string, userId: string, parentId: string | null) {
	return db.transaction(async (tx) => {
		// Before the first read, not between the check and the write: the cycle check
		// answers a question a concurrent move can invalidate. See lockFolderTree.
		await lockFolderTree(tx, folder, userId);

		const [target] = await tx
			.select()
			.from(folder)
			.where(and(eq(folder.id, id), eq(folder.userId, userId)))
			.limit(1);
		if (!target) throw new FolderNotFoundError(id);

		// The destination must be the caller's too. isCycleMove alone does NOT cover
		// this: its seed filters on user_id, so a foreign parentId simply yields an
		// empty walk, reports "no cycle", and the move proceeds.
		await assertOwnedDestination(tx, folder, parentId, userId);

		// Cycle detection: walk ancestors of new parent, ensure `id` is not among them.
		if (parentId && (await isCycleMove(tx, folder, id, parentId, userId))) {
			throw new FolderCycleError(id, parentId);
		}

		try {
			const [row] = await tx
				.update(folder)
				.set({ parentId, updatedAt: new Date() })
				.where(and(eq(folder.id, id), eq(folder.userId, userId)))
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
 * Delete a folder.
 *
 * Default is **non-recursive**: if the folder has any child folder or non-soft-deleted file,
 * throws `FolderNotEmptyError`. Pass `{ recursive: true }` to cascade.
 *
 * Recursive mode collects descendant IDs via CTE first (for audit log / Neo4j sync), then
 * deletes in a transaction. Files under deleted folders get `folderId = null` via existing FK.
 *
 * @throws FolderNotFoundError when the row doesn't exist.
 * @throws FolderNotEmptyError when non-empty and `recursive` is false.
 */
export async function deleteFolder(
	id: string,
	userId: string,
	options: { recursive?: boolean } = {},
): Promise<{ id: string; name: string; deletedIds: string[] }> {
	const { recursive = false } = options;

	return db.transaction(async (tx) => {
		// Both branches read the tree and then act on what they read: "is it empty"
		// and "which ids am I about to cascade away" are stale the moment a
		// concurrent move lands. See lockFolderTree.
		await lockFolderTree(tx, folder, userId);

		const [target] = await tx
			.select()
			.from(folder)
			.where(and(eq(folder.id, id), eq(folder.userId, userId)))
			.limit(1);
		if (!target) throw new FolderNotFoundError(id);

		// Non-recursive: enforce empty precondition.
		if (!recursive) {
			const [sub] = await tx
				.select({ n: sql<number>`count(*)::int` })
				.from(folder)
				.where(and(eq(folder.parentId, id), eq(folder.userId, userId)));
			const [files] = await tx
				.select({ n: sql<number>`count(*)::int` })
				.from(file)
				.where(and(eq(file.folderId, id), eq(file.userId, userId), isNull(file.deletedAt)));
			const total = (sub?.n ?? 0) + (files?.n ?? 0);
			if (total > 0) throw new FolderNotEmptyError(id, total);

			const [row] = await tx
				.delete(folder)
				.where(and(eq(folder.id, id), eq(folder.userId, userId)))
				.returning();
			if (!row) throw new FolderNotFoundError(id);
			return { id: row.id, name: row.name, deletedIds: [row.id] };
		}

		// Recursive: collect the full subtree first so we can return per-node IDs for audit.
		const deletedIds = await collectSubtreeIds(tx, folder, id, userId);

		// One DELETE — the self-FK ON DELETE CASCADE handles the subtree atomically.
		const [row] = await tx
			.delete(folder)
			.where(and(eq(folder.id, id), eq(folder.userId, userId)))
			.returning();
		if (!row) throw new FolderNotFoundError(id);
		return { id: row.id, name: row.name, deletedIds };
	});
}

/**
 * Update spreadsheet cells by file ID. Touches file updatedAt. Skips soft-deleted.
 *
 * Captures a pre-image revision of the current cells/columnMeta BEFORE overwriting
 * (only when content actually changes), so an overwrite is recoverable. `source`
 * attributes the change ('ai' for the deskbot approve-replay, 'user' for the UI).
 *
 * Cells are stored re-derived, as in `createSpreadsheetFile`: the grid's own save is
 * already consistent, an AI save is not until this pass.
 */
export async function updateSpreadsheetByFileId(
	fileId: string,
	userId: string,
	data: {
		expectedVersion: number;
		name?: string;
		cells?: SpreadsheetCells;
		columnMeta?: Record<string, unknown> | null;
	},
	source: RevisionSource = 'user',
	handle: DbHandle = db,
) {
	// Before the locks: a map the sheet cannot hold is refused without touching the row.
	const cells = data.cells === undefined ? undefined : recalculateCells(data.cells);
	return handle.transaction(async (tx) => {
		// Lock before reading the pre-image: concurrent writers must validate against
		// the previous committed save, not the snapshot they both initially read.
		const [fileRow] = await tx
			.select({ id: file.id })
			.from(file)
			.where(and(eq(file.id, fileId), eq(file.userId, userId), isNull(file.deletedAt)))
			.limit(1)
			.for('update');
		if (!fileRow) return null;

		const [current] = await tx
			.select()
			.from(spreadsheet)
			.where(and(eq(spreadsheet.fileId, fileId), isNull(spreadsheet.deletedAt)))
			.limit(1)
			.for('update');
		if (!current) return null;
		if (current.version !== data.expectedVersion) return { status: 'conflict' as const };

		const sheetUpdate: Record<string, unknown> = {};
		if (cells !== undefined) sheetUpdate.cells = cells;
		if (data.columnMeta !== undefined) sheetUpdate.columnMeta = data.columnMeta;

		if (Object.keys(sheetUpdate).length > 0) {
			// Snapshot the pre-image before overwriting content.
			await tx.insert(fileRevision).values({
				id: createId.deskRevision(),
				fileId,
				userId,
				fileType: 'spreadsheet',
				cells: current.cells,
				columnMeta: current.columnMeta ?? null,
				source,
				reason: 'overwrite',
			});

			sheetUpdate.updatedAt = new Date();
			sheetUpdate.version = current.version + 1;
			await tx.update(spreadsheet).set(sheetUpdate).where(eq(spreadsheet.fileId, fileId));
		}

		// Update file metadata (name + touch updatedAt)
		const fileUpdate: Record<string, unknown> = { updatedAt: new Date() };
		if (data.name !== undefined) fileUpdate.name = data.name;

		const [updated] = await tx.update(file).set(fileUpdate).where(eq(file.id, fileId)).returning();

		return updated
			? { status: 'saved' as const, file: updated, version: Number(sheetUpdate.version ?? current.version) }
			: null;
	});
}

/** Create a new markdown file (file + markdown detail in a transaction). Optional `originToolCallId` for agent-created files. */
export async function createMarkdownFile(
	userId: string,
	name = 'Untitled',
	content = '',
	folderId: string | null = null,
	originToolCallId: string | null = null,
	handle: DbHandle = db,
) {
	return handle.transaction(async (tx) => {
		await assertOwnedDestination(tx, folder, folderId, userId);
		const fileId = createId.file();
		const [fileRow] = await tx
			.insert(file)
			.values({ id: fileId, userId, type: 'markdown', name, folderId, originToolCallId })
			.returning();
		const [markdownRow] = await tx
			.insert(markdown)
			.values({ id: createId.markdown(), fileId, userId, content })
			.returning();
		return { file: fileRow, markdown: markdownRow };
	});
}

/**
 * Update markdown content by file ID. Touches file updatedAt. Skips soft-deleted.
 *
 * The same optimistic-concurrency shape as `updateSpreadsheetByFileId`: the caller names
 * the `version` it reviewed and the write happens only if that is still the stored one,
 * under row locks so two writers validate against the last COMMITTED save. Captures a
 * pre-image revision before overwriting so a prompt-injected or accidental overwrite is
 * recoverable. `source` attributes the change ('ai' for the deskbot replay, 'user' for the UI).
 */
export async function updateMarkdownByFileId(
	fileId: string,
	userId: string,
	data: { content: string; expectedVersion: number },
	source: RevisionSource = 'user',
	handle: DbHandle = db,
) {
	return handle.transaction(async (tx) => {
		const [fileRow] = await tx
			.select({ id: file.id })
			.from(file)
			.where(and(eq(file.id, fileId), eq(file.userId, userId), isNull(file.deletedAt)))
			.limit(1)
			.for('update');
		if (!fileRow) return null;

		const [current] = await tx
			.select()
			.from(markdown)
			.where(and(eq(markdown.fileId, fileId), isNull(markdown.deletedAt)))
			.limit(1)
			.for('update');
		if (!current) return null;
		if (current.version !== data.expectedVersion) return { status: 'conflict' as const };

		// Snapshot the pre-image before overwriting content.
		await tx.insert(fileRevision).values({
			id: createId.deskRevision(),
			fileId,
			userId,
			fileType: 'markdown',
			content: current.content,
			source,
			reason: 'overwrite',
		});

		const now = new Date();
		const version = current.version + 1;
		await tx
			.update(markdown)
			.set({ content: data.content, version, updatedAt: now })
			.where(eq(markdown.fileId, fileId));
		const [updated] = await tx.update(file).set({ updatedAt: now }).where(eq(file.id, fileId)).returning();

		return updated ? { status: 'saved' as const, file: updated, version } : null;
	});
}

/**
 * Lock a file row for the rest of the caller's transaction, but only if it has not
 * changed since `sinceUpdatedAt` — the reviewed baseline of a rename or delete the
 * user approved. `changed` means the plan described a file that has since moved on;
 * the caller reports a conflict instead of applying a stale decision. Must run on the
 * transaction that performs the mutation, or the lock protects nothing.
 */
export async function lockFileIfUnchanged(handle: DbHandle, fileId: string, userId: string, sinceUpdatedAt: Date) {
	const [row] = await handle
		.select()
		.from(file)
		.where(and(eq(file.id, fileId), eq(file.userId, userId), isNull(file.deletedAt)))
		.limit(1)
		.for('update');
	if (!row) return null;
	if (row.updatedAt.getTime() !== sinceUpdatedAt.getTime()) return { status: 'changed' as const };
	return { status: 'locked' as const, file: row };
}
