/**
 * DESK RECORD — Detail table for record files: self-describing attribute records.
 *
 * A record stores its own structure — each attribute's label, kind and config beside its
 * value — as one JSONB document (`AttributeRecord`, `#lib/dynamic-attributes`). Whole-document
 * storage, not entity–attribute–value rows: the attributes of one record are read and written
 * together, and a document keeps the order, the removed attributes and any kind this build does
 * not know exactly as they were written. Every write is re-parsed by the same codec the editor
 * uses before it reaches this column (`updateRecordByFileId`).
 *
 * No JSONB index yet: nothing queries inside documents across records. When something does,
 * an expression index on the attribute it filters by beats a GIN index over the whole column.
 */
import { index, integer, jsonb, text, timestamp } from 'drizzle-orm/pg-core';
import type { AttributeRecord } from '#lib/dynamic-attributes/index.ts';
import { user } from '../auth/_better-auth';
import { file } from './file';
import { deskSchema } from './schema';

export const deskRecord = deskSchema.table(
	'record',
	{
		/** Prefixed `rcd_`. */
		id: text('id').primaryKey(),
		/** FK to desk.file — links to the unified file registry. */
		fileId: text('file_id')
			.notNull()
			.references(() => file.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		/** The self-describing record. Its `format` is the shape number; `version` below is concurrency. */
		document: jsonb('document').$type<AttributeRecord>().notNull(),
		/** Optimistic concurrency token, as on `spreadsheet` and `markdown`. */
		version: integer('version').notNull().default(0),
		/** Soft-delete — kept in sync with `file.deletedAt`. See `desk/file.ts` for rationale. */
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('record_file_idx').on(table.fileId),
		index('record_user_updated_idx').on(table.userId, table.updatedAt),
	],
);
