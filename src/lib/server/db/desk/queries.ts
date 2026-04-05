import { and, count, desc, eq } from 'drizzle-orm';
import { db } from '../index';
import { file, folder, spreadsheet } from '../schema/desk';

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
export async function listSpreadsheets(userId: string) {
	return db
		.select({
			id: spreadsheet.id,
			name: spreadsheet.name,
			createdAt: spreadsheet.createdAt,
			updatedAt: spreadsheet.updatedAt,
		})
		.from(spreadsheet)
		.where(eq(spreadsheet.userId, userId))
		.orderBy(desc(spreadsheet.updatedAt))
		.limit(50);
}

// ── File registry queries ──────────────────────────────────────────

/** List all files for a user, optionally filtered by type. Newest first. */
export async function listFiles(userId: string, type?: string) {
	const conditions = [eq(file.userId, userId)];
	if (type) {
		conditions.push(eq(file.type, type as 'spreadsheet'));
	}
	return db
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
		.where(and(...conditions))
		.orderBy(desc(file.updatedAt))
		.limit(200);
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

// ── Folder queries ────────────────────────────────────────────────

/** List all folders for a user (flat). Client builds the tree. */
export async function listFolders(userId: string) {
	return db
		.select({
			id: folder.id,
			parentId: folder.parentId,
			name: folder.name,
			createdAt: folder.createdAt,
			updatedAt: folder.updatedAt,
		})
		.from(folder)
		.where(eq(folder.userId, userId))
		.orderBy(folder.name);
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
