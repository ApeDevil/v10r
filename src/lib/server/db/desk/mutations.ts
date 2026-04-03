import { and, eq } from 'drizzle-orm';
import { db } from '../index';
import { createId } from '../id';
import { spreadsheet } from '../schema/desk';

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
