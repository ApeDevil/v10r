/**
 * DESK FOLDER — Hierarchical folder structure for the desk workspace.
 *
 * Pure adjacency list: each folder has an optional parent_id pointing to
 * its parent folder. Self-FK with ON DELETE CASCADE removes entire subtrees.
 *
 * Only desk files (spreadsheets, etc.) can be placed in folders.
 * Blog posts and assets appear as virtual folders in the Explorer.
 */
import { type AnyPgColumn, index, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
import { deskSchema } from './schema';

export const folder = deskSchema.table(
	'folder',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		/** Parent folder ID. NULL = root level. */
		parentId: text('parent_id').references((): AnyPgColumn => folder.id, { onDelete: 'cascade' }),
		name: text('name').notNull().default('New Folder'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex('desk_folder_user_parent_name_idx').on(table.userId, table.parentId, table.name),
		index('desk_folder_user_idx').on(table.userId),
	],
);
