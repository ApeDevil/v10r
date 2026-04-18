/**
 * BLOG POST-FOLDER — Hierarchical folder structure for blog posts.
 *
 * Mirrors `desk.folder`: adjacency list with self-FK cascade, per-user ownership,
 * unique `(userId, parentId, name)` nullsNotDistinct so both root and nested
 * collisions surface as `folder_name_conflict` instead of raw PG errors.
 *
 * Separate table (not unified with desk) so `blog.post.folder_id` can FK-narrow
 * to only blog-post folders at the DB layer — cross-domain placement is
 * impossible, no discriminator column needed.
 */
import { type AnyPgColumn, index, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
import { blogSchema } from './post';

export const postFolder = blogSchema.table(
	'post_folder',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		parentId: text('parent_id').references((): AnyPgColumn => postFolder.id, { onDelete: 'cascade' }),
		name: text('name').notNull().default('New Folder'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		unique('blog_post_folder_user_parent_name_key').on(table.userId, table.parentId, table.name).nullsNotDistinct(),
		index('blog_post_folder_user_idx').on(table.userId),
	],
);
