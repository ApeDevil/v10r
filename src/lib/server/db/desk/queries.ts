import { and, count, desc, eq } from 'drizzle-orm';
import { db } from '../index';
import { file, folder, markdown, spreadsheet } from '../schema/desk';

// ── Legacy queries (kept for backward compat) ──────────────────────

/** Get a single spreadsheet with ownership check. */
export async function getSpreadsheet(id: string, userId: string) {
	const [row] = await db
		.select()
		.from(spreadsheet)
		.where(and(eq(spreadsheet.id, id), eq(spreadsheet.userId, userId)))
		.limit(1);
	return row ?? null;
}

/** List user's spreadsheets, newest first. */
export async function listSpreadsheets(userId: string, offset = 0, limit = 50) {
	const where = eq(spreadsheet.userId, userId);
	const [items, [countResult]] = await Promise.all([
		db
			.select({
				id: spreadsheet.id,
				name: spreadsheet.name,
				createdAt: spreadsheet.createdAt,
				updatedAt: spreadsheet.updatedAt,
			})
			.from(spreadsheet)
			.where(where)
			.orderBy(desc(spreadsheet.updatedAt))
			.offset(offset)
			.limit(limit),
		db.select({ total: count() }).from(spreadsheet).where(where),
	]);
	return { items, total: countResult?.total ?? 0 };
}

// ── File registry queries ──────────────────────────────────────────

/** List all files for a user, optionally filtered by type. Newest first. */
export async function listFiles(userId: string, type?: string, offset = 0, limit = 50) {
	const conditions = [eq(file.userId, userId)];
	if (type) {
		conditions.push(eq(file.type, type as 'spreadsheet' | 'markdown'));
	}
	const where = and(...conditions);
	const [items, [countResult]] = await Promise.all([
		db
			.select({
				id: file.id,
				type: file.type,
				name: file.name,
				folderId: file.folderId,
				aiContext: file.aiContext,
				createdAt: file.createdAt,
				updatedAt: file.updatedAt,
			})
			.from(file)
			.where(where)
			.orderBy(desc(file.updatedAt))
			.offset(offset)
			.limit(limit),
		db.select({ total: count() }).from(file).where(where),
	]);
	return { items, total: countResult?.total ?? 0 };
}

/** Get a single file with ownership check. */
export async function getFile(id: string, userId: string) {
	const [row] = await db
		.select()
		.from(file)
		.where(and(eq(file.id, id), eq(file.userId, userId)))
		.limit(1);
	return row ?? null;
}

/** Get a spreadsheet by its file ID (joined). */
export async function getSpreadsheetByFileId(fileId: string, userId: string) {
	const [row] = await db
		.select({
			file: {
				id: file.id,
				type: file.type,
				name: file.name,
				folderId: file.folderId,
				aiContext: file.aiContext,
				createdAt: file.createdAt,
				updatedAt: file.updatedAt,
			},
			spreadsheet: {
				id: spreadsheet.id,
				cells: spreadsheet.cells,
				columnMeta: spreadsheet.columnMeta,
			},
		})
		.from(file)
		.innerJoin(spreadsheet, eq(spreadsheet.fileId, file.id))
		.where(and(eq(file.id, fileId), eq(file.userId, userId)))
		.limit(1);
	return row ?? null;
}

/** Get a markdown document by its file ID (joined). */
export async function getMarkdownByFileId(fileId: string, userId: string) {
	const [row] = await db
		.select({
			file: {
				id: file.id,
				type: file.type,
				name: file.name,
				folderId: file.folderId,
				aiContext: file.aiContext,
				createdAt: file.createdAt,
				updatedAt: file.updatedAt,
			},
			markdown: {
				id: markdown.id,
				content: markdown.content,
			},
		})
		.from(file)
		.innerJoin(markdown, eq(markdown.fileId, file.id))
		.where(and(eq(file.id, fileId), eq(file.userId, userId)))
		.limit(1);
	return row ?? null;
}

// ── Folder queries ────────────────────────────────────────────────

/** List all folders for a user (flat). Client builds the tree. */
export async function listFolders(userId: string, offset = 0, limit = 50) {
	const where = eq(folder.userId, userId);
	const [items, [countResult]] = await Promise.all([
		db
			.select({
				id: folder.id,
				parentId: folder.parentId,
				name: folder.name,
				createdAt: folder.createdAt,
				updatedAt: folder.updatedAt,
			})
			.from(folder)
			.where(where)
			.orderBy(folder.name)
			.offset(offset)
			.limit(limit),
		db.select({ total: count() }).from(folder).where(where),
	]);
	return { items, total: countResult?.total ?? 0 };
}

/** Get a single folder with ownership check. */
export async function getFolder(id: string, userId: string) {
	const [row] = await db
		.select()
		.from(folder)
		.where(and(eq(folder.id, id), eq(folder.userId, userId)))
		.limit(1);
	return row ?? null;
}

/** Count subfolders + files inside a folder (for delete confirmation). */
export async function countFolderContents(id: string, userId: string) {
	const [subfolders] = await db
		.select({ count: count() })
		.from(folder)
		.where(and(eq(folder.parentId, id), eq(folder.userId, userId)));
	const [files] = await db
		.select({ count: count() })
		.from(file)
		.where(and(eq(file.folderId, id), eq(file.userId, userId)));
	return (subfolders?.count ?? 0) + (files?.count ?? 0);
}

/** Get all files with ai_context = true for a user. */
export async function getAiContextFiles(userId: string) {
	return db
		.select({
			id: file.id,
			type: file.type,
			name: file.name,
			folderId: file.folderId,
		})
		.from(file)
		.where(and(eq(file.userId, userId), eq(file.aiContext, true)));
}
