/**
 * DESK FILE — Unified registry for all file types in the desk workspace.
 *
 * The Explorer queries this single table for listings. Type-specific data
 * (spreadsheet cells, future diagram content, etc.) lives in detail tables
 * joined by file_id.
 */
import { sql } from 'drizzle-orm';
import { boolean, index, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
import { folder } from './folder';
import { deskSchema } from './schema';

export const fileTypeEnum = deskSchema.enum('file_type', ['spreadsheet', 'markdown']);

export const file = deskSchema.table(
	'file',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		type: fileTypeEnum('type').notNull(),
		name: text('name').notNull().default('Untitled'),
		/** Parent folder. NULL = root of data/ section. */
		folderId: text('folder_id').references(() => folder.id, { onDelete: 'set null' }),
		/** When true, file content is included in AI chat context. */
		aiContext: boolean('ai_context').notNull().default(false),
		/**
		 * Soft-delete timestamp. When non-null, the file is trashed.
		 * All read paths must filter `WHERE deleted_at IS NULL`. Backs the
		 * "undo delete" affordance in the I/O Log and lowers the UX friction
		 * on destructive actions because delete is now reversible.
		 */
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		/**
		 * Tool call that created this file, if any. NULL for human-created files.
		 * Enables blast-radius queries ("what did this agent action produce?")
		 * and audit trails.
		 *
		 * Untyped FK (not `.references()`) to avoid a circular schema import
		 * between desk and ai. Integrity is maintained in code, not SQL.
		 */
		originToolCallId: text('origin_tool_call_id'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('desk_file_user_type_idx').on(table.userId, table.type).where(sql`${table.deletedAt} IS NULL`),
		index('desk_file_user_updated_idx').on(table.userId, table.updatedAt).where(sql`${table.deletedAt} IS NULL`),
		index('desk_file_user_folder_idx').on(table.userId, table.folderId).where(sql`${table.deletedAt} IS NULL`),
		index('desk_file_ai_context_idx')
			.on(table.userId)
			.where(sql`${table.aiContext} = true AND ${table.deletedAt} IS NULL`),
		index('desk_file_origin_tool_call_idx').on(table.originToolCallId),
	],
);
