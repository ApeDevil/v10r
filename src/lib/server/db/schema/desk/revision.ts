/**
 * DESK FILE REVISION — pre-image snapshots for recoverable content mutations.
 *
 * A revision is captured BEFORE a destructive content mutation runs
 * (overwrite of markdown/spreadsheet content, or a delete). It stores the
 * *old* content so a prompt-injected or fat-fingered overwrite is no longer
 * irrecoverable — the file registry's soft-delete only protects deletes, not
 * in-place overwrites, which is the gap this table closes.
 *
 * `fileId` is an UNTYPED reference (no SQL FK) to `desk.file.id`, mirroring the
 * `file.originToolCallId` convention: integrity is maintained in code, not by a
 * constraint. This deliberately decouples a revision's lifetime from its file's
 * so a delete pre-image survives even a hard retention sweep of the file row —
 * the snapshot stays useful precisely when the file is gone. Cleanup is bounded
 * instead by the `userId` FK cascade (revisions vanish with the account).
 */
import { index, jsonb, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
import { fileTypeEnum } from './file';
import { deskSchema } from './schema';

/** Who authored the mutation whose pre-image this row captured. */
export const revisionSourceEnum = deskSchema.enum('revision_source', ['ai', 'user']);

/** The kind of mutation that triggered the snapshot. */
export const revisionReasonEnum = deskSchema.enum('revision_reason', ['overwrite', 'delete']);

export const fileRevision = deskSchema.table(
	'file_revision',
	{
		/** Prefixed `drv_`. */
		id: text('id').primaryKey(),
		/**
		 * The file this snapshot belongs to. Untyped ref (no FK) — see module doc.
		 * Not guaranteed to still exist in `desk.file` (survives hard delete).
		 */
		fileId: text('file_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		fileType: fileTypeEnum('file_type').notNull(),
		/** Markdown pre-image content. NULL for spreadsheet snapshots. */
		content: text('content'),
		/** Spreadsheet pre-image cell map. NULL for markdown snapshots. */
		cells: jsonb('cells'),
		/** Spreadsheet pre-image column metadata. NULL for markdown snapshots. */
		columnMeta: jsonb('column_meta'),
		/** Whether the AI harness or a human triggered the mutation. */
		source: revisionSourceEnum('source').notNull().default('user'),
		/** `overwrite` (content replaced) or `delete` (file trashed). */
		reason: revisionReasonEnum('reason').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		// Newest-first history for a single file.
		index('desk_file_revision_file_idx').on(table.fileId, table.createdAt),
		// Per-user sweep / audit scans.
		index('desk_file_revision_user_idx').on(table.userId, table.createdAt),
	],
);
