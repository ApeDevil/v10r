/**
 * DESK FILE — Unified registry for all file types in the desk workspace.
 *
 * The Explorer queries this single table for listings. Type-specific data
 * (spreadsheet cells, future diagram content, etc.) lives in detail tables
 * joined by file_id.
 */
import { index, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
import { deskSchema } from './schema';

export const fileTypeEnum = deskSchema.enum('file_type', ['spreadsheet']);

export const file = deskSchema.table(
	'file',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		type: fileTypeEnum('type').notNull(),
		name: text('name').notNull().default('Untitled'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('desk_file_user_type_idx').on(table.userId, table.type),
		index('desk_file_user_updated_idx').on(table.userId, table.updatedAt),
	],
);
