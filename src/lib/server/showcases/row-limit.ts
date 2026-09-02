/**
 * Growth guard for the public showcase tables.
 *
 * Anyone can write to these without signing in, so every mutating showcase handler checks
 * this first. It bounds demo data; it is not a product limit.
 */

import type { PgTable } from 'drizzle-orm/pg-core';
import { countRows } from '$lib/server/db/showcase/guards';
import { MAX_SHOWCASE_ROWS } from './config';

/** Null when there is room; a reader-facing reason when the table is full. */
export async function checkRowLimit(table: PgTable, limit = MAX_SHOWCASE_ROWS): Promise<string | null> {
	const count = await countRows(table);
	return count >= limit ? `Showcase limit reached (${limit} rows). Use reset to clear.` : null;
}
