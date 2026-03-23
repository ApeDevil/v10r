/**
 * BLOG POST — Aggregate root for blog content.
 * Owns revisions, tags, and asset associations.
 * Soft-deletable via deleted_at.
 */
import { sql } from 'drizzle-orm';
import { check, index, pgSchema, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';

export const blogSchema = pgSchema('blog');

export const postStatusEnum = blogSchema.enum('post_status', ['draft', 'published', 'archived']);

export const post = blogSchema.table(
	'post',
	{
		id: text('id').primaryKey(),
		slug: text('slug').notNull(),
		authorId: text('author_id')
			.notNull()
			.references(() => user.id, { onDelete: 'restrict' }),
		coverImageId: text('cover_image_id'),
		status: postStatusEnum('status').notNull().default('draft'),
		publishedAt: timestamp('published_at', { withTimezone: true }),
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex('blog_post_slug_idx').on(table.slug).where(sql`deleted_at IS NULL`),
		index('blog_post_author_idx').on(table.authorId),
		index('blog_post_status_published_idx').on(table.status, table.publishedAt.desc()),
		index('blog_post_active_idx').on(table.createdAt).where(sql`deleted_at IS NULL`),
		check('slug_format', sql`${table.slug} ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'`),
	],
);
