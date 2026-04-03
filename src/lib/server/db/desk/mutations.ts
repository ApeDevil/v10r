import { and, eq } from 'drizzle-orm';
import { db } from '../index';
import { createId } from '../id';
import { file, spreadsheet } from '../schema/desk';

// ── Legacy mutations (kept for backward compat) ────────────────────

/** Create a new spreadsheet. */
export async function createSpreadsheet(
	userId: string,
	name = 'Untitled',
	cells: Record<string, unknown> = {},
) {
	const [row] = await db
		.insert(spreadsheet)
		.values({ id: createId.spreadsheet(), userId, name, cells })
		.returning();
	return row;
}

/** Update a spreadsheet (ownership enforced via WHERE). Returns null if not found/not owned. */
export async function updateSpreadsheet(
	id: string,
	userId: string,
	data: { name?: string; cells?: Record<string, unknown>; columnMeta?: Record<string, unknown> | null },
) {
	const [row] = await db
		.update(spreadsheet)
		.set({ ...data, updatedAt: new Date() })
		.where(and(eq(spreadsheet.id, id), eq(spreadsheet.userId, userId)))
		.returning();
	return row ?? null;
}

// ── File registry mutations ────────────────────────────────────────

/** Create a new spreadsheet file (file + spreadsheet in a transaction). */
export async function createSpreadsheetFile(
	userId: string,
	name = 'Untitled',
	cells: Record<string, unknown> = {},
) {
	return db.transaction(async (tx) => {
		const fileId = createId.file();
		const [fileRow] = await tx
			.insert(file)
			.values({ id: fileId, userId, type: 'spreadsheet', name })
			.returning();
		const [sheetRow] = await tx
			.insert(spreadsheet)
			.values({ id: createId.spreadsheet(), fileId, userId, name, cells })
			.returning();
		return { file: fileRow, spreadsheet: sheetRow };
	});
}

/** Rename a file. */
export async function renameFile(id: string, userId: string, name: string) {
	const [row] = await db
		.update(file)
		.set({ name, updatedAt: new Date() })
		.where(and(eq(file.id, id), eq(file.userId, userId)))
		.returning();
	return row ?? null;
}

/** Delete a file (cascades to detail table via FK). */
export async function deleteFile(id: string, userId: string) {
	const [row] = await db
		.delete(file)
		.where(and(eq(file.id, id), eq(file.userId, userId)))
		.returning();
	return row ?? null;
}

/** Update spreadsheet cells by file ID. Touches file updatedAt. */
export async function updateSpreadsheetByFileId(
	fileId: string,
	userId: string,
	data: { name?: string; cells?: Record<string, unknown>; columnMeta?: Record<string, unknown> | null },
) {
	// Verify ownership via file table
	const [fileRow] = await db
		.select({ id: file.id })
		.from(file)
		.where(and(eq(file.id, fileId), eq(file.userId, userId)))
		.limit(1);
	if (!fileRow) return null;

	// Update spreadsheet detail
	const sheetUpdate: Record<string, unknown> = {};
	if (data.cells !== undefined) sheetUpdate.cells = data.cells;
	if (data.columnMeta !== undefined) sheetUpdate.columnMeta = data.columnMeta;

	if (Object.keys(sheetUpdate).length > 0) {
		await db
			.update(spreadsheet)
			.set(sheetUpdate)
			.where(eq(spreadsheet.fileId, fileId));
	}

	// Update file metadata (name + touch updatedAt)
	const fileUpdate: Record<string, unknown> = { updatedAt: new Date() };
	if (data.name !== undefined) fileUpdate.name = data.name;

	const [updated] = await db
		.update(file)
		.set(fileUpdate)
		.where(eq(file.id, fileId))
		.returning();

	return updated ?? null;
}
