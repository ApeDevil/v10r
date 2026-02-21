/**
 * Showcase safety guards — row limits and validation helpers.
 * Prevents unbounded growth in public-facing showcase tables.
 */
import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';
import type { PgTableWithColumns } from 'drizzle-orm/pg-core';

const MAX_SHOWCASE_ROWS = 50;

/**
 * Check if a table has reached the row limit.
 * Returns an error message if the limit is reached, null otherwise.
 */
export async function checkRowLimit(
	table: PgTableWithColumns<any>,
	limit = MAX_SHOWCASE_ROWS,
): Promise<string | null> {
	const [result] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(table);
	if (result.count >= limit) {
		return `Showcase limit reached (${limit} rows). Use reset to clear.`;
	}
	return null;
}
