/**
 * DESK SPREADSHEET — Persistence for desk workspace spreadsheets.
 *
 * Single sheet per spreadsheet, JSONB sparse map for cell data.
 * Grid: 50 rows × 26 columns (A–Z), explicit save.
 *
 * Cell format (sparse, only non-empty cells stored):
 *   { "A1": { v: "Header", t: "text" }, "B2": { v: 42, f: "=SUM(B3:B5)" } }
 *
 * Where:
 *   v = raw value (string | number | null)
 *   f = formula text (optional, omitted if not a formula)
 *   t = format type (optional, omitted for 'auto')
 */
import { index, jsonb, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';

export const deskSchema = pgSchema('desk');

export const spreadsheet = deskSchema.table(
	'spreadsheet',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: text('name').notNull().default('Untitled'),
		/** Sparse cell map — only populated cells stored. Key = "A1", Value = { v, f?, t? } */
		cells: jsonb('cells').notNull().default({}),
		/** Column metadata: header labels, widths. Key = "A", Value = { label?, width? } */
		columnMeta: jsonb('column_meta'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index('spreadsheet_user_updated_idx').on(table.userId, table.updatedAt)],
);
