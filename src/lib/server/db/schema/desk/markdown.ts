/**
 * DESK MARKDOWN — Detail table for markdown files in the desk workspace.
 *
 * Follows the same pattern as spreadsheet: the file registry row (desk.file)
 * provides metadata, this table stores the type-specific content.
 */
import { index, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
import { file } from './file';
import { deskSchema } from './schema';

export const markdown = deskSchema.table(
	'markdown',
	{
		id: text('id').primaryKey(),
		/** FK to desk.file — links to the unified file registry. */
		fileId: text('file_id')
			.notNull()
			.references(() => file.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		/** Raw markdown content. */
		content: text('content').notNull().default(''),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('markdown_file_idx').on(table.fileId),
		index('markdown_user_updated_idx').on(table.userId, table.updatedAt),
	],
);
