/**
 * BLOG ASSET-FOLDER — Hierarchical folder structure for blog assets.
 *
 * Mirrors `desk.folder` and `blog.post_folder`: adjacency list with self-FK
 * cascade, per-user ownership, unique `(userId, parentId, name)` nullsNotDistinct.
 *
 * Separate table so `blog.asset.folder_id` can FK-narrow to only asset folders —
 * placing an asset in a post folder is impossible at the DB layer.
 */
import { type AnyPgColumn, index, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
import { blogSchema } from './post';

export const assetFolder = blogSchema.table(
	'asset_folder',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		parentId: text('parent_id').references((): AnyPgColumn => assetFolder.id, { onDelete: 'cascade' }),
		name: text('name').notNull().default('New Folder'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		unique('blog_asset_folder_user_parent_name_key').on(table.userId, table.parentId, table.name).nullsNotDistinct(),
		index('blog_asset_folder_user_idx').on(table.userId),
	],
);
