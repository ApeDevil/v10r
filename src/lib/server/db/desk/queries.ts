import { and, desc, eq } from 'drizzle-orm';
import { db } from '../index';
import { spreadsheet } from '../schema/desk';

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
