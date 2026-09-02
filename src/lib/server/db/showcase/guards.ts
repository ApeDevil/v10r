/**
 * Row counting for the public showcase tables. The cap those counts are compared against
 * is showcase policy, not a property of the data — see `showcases/row-limit.ts`.
 */

import { sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { db } from '$lib/server/db';

export async function countRows(table: PgTable): Promise<number> {
	const [result] = await db.select({ count: sql<number>`count(*)::int` }).from(table);
	return result.count;
}
