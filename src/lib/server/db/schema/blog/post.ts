/**
 * BLOG POST — Aggregate root for blog content.
 * Owns revisions, tags, and asset associations.
 * Soft-deletable via deleted_at.
 *
 * BLOG DOMAIN — Subject area taxonomy (one per post).
 * Co-located here (above post) so post.domainId can reference it directly.
 * The `blog` schema object lives in ./schema so folder/cover FKs can be wired
 * inline without the post ↔ folder/asset import cycle re-forming.
 */
import { sql } from 'drizzle-orm';
import { type AnyPgColumn, check, index, integer, jsonb, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import type { TranslationMap } from '$lib/i18n/translate';
import { user } from '../auth/_better-auth';
import { asset } from './asset';
import { postFolder } from './post-folder';
import { blogSchema } from './schema';

export const domain = blogSchema.table(
	'domain',
	{
		id: text('id').primaryKey(),
		slug: text('slug').notNull(),
		name: text('name').notNull(),
		icon: text('icon'),
		color: integer('color'),
		description: text('description'),
		nameI18n: jsonb('name_i18n').$type<TranslationMap>().notNull().default(sql`'{}'::jsonb`),
		descriptionI18n: jsonb('description_i18n').$type<TranslationMap>().notNull().default(sql`'{}'::jsonb`),
	},
	(table) => [
		uniqueIndex('blog_domain_slug_idx').on(table.slug),
		check('domain_slug_format', sql`${table.slug} ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'`),
		check('domain_color_range', sql`${table.color} IS NULL OR (${table.color} >= 1 AND ${table.color} <= 8)`),
	],
);

export const postStatusEnum = blogSchema.enum('post_status', ['draft', 'published', 'archived']);

export const post = blogSchema.table(
	'post',
	{
		id: text('id').primaryKey(),
		slug: text('slug').notNull(),
		authorId: text('author_id')
			.notNull()
			.references(() => user.id, { onDelete: 'restrict' }),
		/** Cover image. Deleting the asset clears the cover (SET NULL) rather than blocking. */
		coverImageId: text('cover_image_id').references((): AnyPgColumn => asset.id, { onDelete: 'set null' }),
		domainId: text('domain_id').references(() => domain.id, { onDelete: 'set null' }),
		/** Parent folder (nullable = root level under virtual:blog). Deleting a folder orphans posts to root (SET NULL). */
		folderId: text('folder_id').references(() => postFolder.id, { onDelete: 'set null' }),
		status: postStatusEnum('status').notNull().default('draft'),
		publishedAt: timestamp('published_at', { withTimezone: true }),
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		/**
		 * File-as-source marker. When set, this post is owned by a markdown file at this path
		 * (e.g. `content/blog/my-slug`) and the admin UI hides content-edit affordances.
		 * NULL = admin-managed (existing posts and ad-hoc admin-created posts).
		 */
		sourcePath: text('source_path'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex('blog_post_slug_idx').on(table.slug).where(sql`deleted_at IS NULL`),
		uniqueIndex('blog_post_source_path_idx').on(table.sourcePath).where(sql`source_path IS NOT NULL`),
		index('blog_post_author_idx').on(table.authorId),
		index('blog_post_status_published_idx').on(table.status, table.publishedAt.desc()),
		index('blog_post_active_idx').on(table.createdAt).where(sql`deleted_at IS NULL`),
		check('slug_format', sql`${table.slug} ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'`),
		index('blog_post_domain_idx').on(table.domainId),
		index('blog_post_author_folder_idx').on(table.authorId, table.folderId),
		// Single-column FK indexes back the ON DELETE SET NULL scans (folder / cover-asset delete).
		index('blog_post_folder_idx').on(table.folderId),
		index('blog_post_cover_image_idx').on(table.coverImageId),
	],
);
