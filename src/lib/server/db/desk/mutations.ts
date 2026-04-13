import { and, eq, isNull, like, sql } from 'drizzle-orm';
import { createId } from '../id';
import { db } from '../index';
import { file, folder, markdown, spreadsheet } from '../schema/desk';

/** Update a spreadsheet (ownership enforced via WHERE). Returns null if not found/not owned or soft-deleted. */
export async function updateSpreadsheet(
	id: string,
	userId: string,
	data: { name?: string; cells?: Record<string, unknown>; columnMeta?: Record<string, unknown> | null },
) {
	const [row] = await db
		.update(spreadsheet)
		.set({ ...data, updatedAt: new Date() })
		.where(and(eq(spreadsheet.id, id), eq(spreadsheet.userId, userId), isNull(spreadsheet.deletedAt)))
		.returning();
	return row ?? null;
}

// ── File registry mutations ────────────────────────────────────────

/**
 * Create a new spreadsheet file (file + spreadsheet in a transaction).
 *
 * `originToolCallId` threads the creator agent action through for blast-radius
 * queries ("which files did this tool call produce?"). NULL for human creates.
 */
export async function createSpreadsheetFile(
	userId: string,
	name = 'Untitled',
	cells: Record<string, unknown> = {},
	folderId: string | null = null,
	originToolCallId: string | null = null,
) {
	return db.transaction(async (tx) => {
		const fileId = createId.file();
		const [fileRow] = await tx
			.insert(file)
			.values({ id: fileId, userId, type: 'spreadsheet', name, folderId, originToolCallId })
			.returning();
		const [sheetRow] = await tx
			.insert(spreadsheet)
			.values({ id: createId.spreadsheet(), fileId, userId, name, cells })
			.returning();
		return { file: fileRow, spreadsheet: sheetRow };
	});
}

/** Rename a file. Skips soft-deleted rows. */
export async function renameFile(id: string, userId: string, name: string) {
	const [row] = await db
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
 * file disappears from every list, tree, and AI tool. An I/O Log chip
 * can still call `restoreFile` to bring it back within the retention
 * window. The actual row stays in place until a retention sweep runs.
 */
export async function deleteFile(id: string, userId: string) {
	return db.transaction(async (tx) => {
		const now = new Date();
		const [fileRow] = await tx
			.update(file)
			.set({ deletedAt: now, updatedAt: now })
			.where(and(eq(file.id, id), eq(file.userId, userId), isNull(file.deletedAt)))
			.returning();
		if (!fileRow) return null;

		// Soft-delete the matching detail row too so the `isNull(spreadsheet.deletedAt)`
		// guards in joined queries exclude it as well.
		if (fileRow.type === 'spreadsheet') {
			await tx.update(spreadsheet).set({ deletedAt: now }).where(eq(spreadsheet.fileId, id));
		} else if (fileRow.type === 'markdown') {
			await tx.update(markdown).set({ deletedAt: now }).where(eq(markdown.fileId, id));
		}
		return fileRow;
	});
}

/**
 * Restore a soft-deleted file (undo delete).
 *
 * Mirror of `deleteFile` — clears `deleted_at` on the file and the
 * matching detail row. Returns `null` if no soft-deleted file matches.
 */
export async function restoreFile(id: string, userId: string) {
	return db.transaction(async (tx) => {
		const now = new Date();
		const [fileRow] = await tx
			.update(file)
			.set({ deletedAt: null, updatedAt: now })
			.where(and(eq(file.id, id), eq(file.userId, userId), sql`${file.deletedAt} IS NOT NULL`))
			.returning();
		if (!fileRow) return null;

		if (fileRow.type === 'spreadsheet') {
			await tx.update(spreadsheet).set({ deletedAt: null }).where(eq(spreadsheet.fileId, id));
		} else if (fileRow.type === 'markdown') {
			await tx.update(markdown).set({ deletedAt: null }).where(eq(markdown.fileId, id));
		}
		return fileRow;
	});
}

/** Move a file to a folder (or root if folderId is null). Skips soft-deleted. */
export async function moveFile(id: string, userId: string, folderId: string | null) {
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
	// Get original file + spreadsheet
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

	// Compute duplicate name
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

// ── Folder mutations ──────────────────────────────────────────────

/** Create a new folder. */
export async function createFolder(userId: string, name = 'New Folder', parentId: string | null = null) {
	const [row] = await db.insert(folder).values({ id: createId.folder(), userId, parentId, name }).returning();
	return row;
}

/** Rename a folder. */
export async function renameFolder(id: string, userId: string, name: string) {
	const [row] = await db
		.update(folder)
		.set({ name, updatedAt: new Date() })
		.where(and(eq(folder.id, id), eq(folder.userId, userId)))
		.returning();
	return row ?? null;
}

/**
 * Move a folder to a new parent. Validates no cycle via ancestor walk.
 * Returns null if not found, throws if cycle detected.
 */
export async function moveFolder(id: string, userId: string, parentId: string | null) {
	// Check ownership
	const [target] = await db
		.select()
		.from(folder)
		.where(and(eq(folder.id, id), eq(folder.userId, userId)))
		.limit(1);
	if (!target) return null;

	// Cycle detection: walk ancestors of new parent, ensure `id` is not among them
	if (parentId) {
		const result = await db.execute(sql`
			WITH RECURSIVE ancestors AS (
				SELECT id, parent_id FROM desk.folder WHERE id = ${parentId} AND user_id = ${userId}
				UNION ALL
				SELECT f.id, f.parent_id FROM desk.folder f JOIN ancestors a ON f.id = a.parent_id
			)
			SELECT EXISTS(SELECT 1 FROM ancestors WHERE id = ${id}) AS is_cycle
		`);
		if ((result as unknown as { rows?: { is_cycle: boolean }[] }).rows?.[0]?.is_cycle) {
			throw new Error('Cannot move folder into its own descendant.');
		}
	}

	const [row] = await db
		.update(folder)
		.set({ parentId, updatedAt: new Date() })
		.where(and(eq(folder.id, id), eq(folder.userId, userId)))
		.returning();
	return row ?? null;
}

/** Delete a folder (cascades to subfolders via FK). */
export async function deleteFolder(id: string, userId: string) {
	const [row] = await db
		.delete(folder)
		.where(and(eq(folder.id, id), eq(folder.userId, userId)))
		.returning();
	return row ?? null;
}

/** Update spreadsheet cells by file ID. Touches file updatedAt. Skips soft-deleted. */
export async function updateSpreadsheetByFileId(
	fileId: string,
	userId: string,
	data: { name?: string; cells?: Record<string, unknown>; columnMeta?: Record<string, unknown> | null },
) {
	return db.transaction(async (tx) => {
		// Verify ownership via file table — must not be soft-deleted.
		const [fileRow] = await tx
			.select({ id: file.id })
			.from(file)
			.where(and(eq(file.id, fileId), eq(file.userId, userId), isNull(file.deletedAt)))
			.limit(1);
		if (!fileRow) return null;

		// Update spreadsheet detail
		const sheetUpdate: Record<string, unknown> = {};
		if (data.cells !== undefined) sheetUpdate.cells = data.cells;
		if (data.columnMeta !== undefined) sheetUpdate.columnMeta = data.columnMeta;

		if (Object.keys(sheetUpdate).length > 0) {
			sheetUpdate.updatedAt = new Date();
			await tx.update(spreadsheet).set(sheetUpdate).where(eq(spreadsheet.fileId, fileId));
		}

		// Update file metadata (name + touch updatedAt)
		const fileUpdate: Record<string, unknown> = { updatedAt: new Date() };
		if (data.name !== undefined) fileUpdate.name = data.name;

		const [updated] = await tx.update(file).set(fileUpdate).where(eq(file.id, fileId)).returning();

		return updated ?? null;
	});
}

/** Create a new markdown file (file + markdown detail in a transaction). Optional `originToolCallId` for agent-created files. */
export async function createMarkdownFile(
	userId: string,
	name = 'Untitled',
	content = '',
	folderId: string | null = null,
	originToolCallId: string | null = null,
) {
	return db.transaction(async (tx) => {
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

/** Update markdown content by file ID. Touches file updatedAt. Skips soft-deleted. */
export async function updateMarkdownByFileId(fileId: string, userId: string, content: string) {
	return db.transaction(async (tx) => {
		// Verify ownership via file table — must not be soft-deleted.
		const [fileRow] = await tx
			.select({ id: file.id })
			.from(file)
			.where(and(eq(file.id, fileId), eq(file.userId, userId), isNull(file.deletedAt)))
			.limit(1);
		if (!fileRow) return null;

		await tx.update(markdown).set({ content, updatedAt: new Date() }).where(eq(markdown.fileId, fileId));

		const [updated] = await tx.update(file).set({ updatedAt: new Date() }).where(eq(file.id, fileId)).returning();

		return updated ?? null;
	});
}
