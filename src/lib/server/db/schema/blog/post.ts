/**
 * BLOG POST — Aggregate root for blog content.
 * Owns revisions, tags, and asset associations.
 * Soft-deletable via deleted_at.
 *
 * BLOG DOMAIN — Subject area taxonomy (one per post).
 * Defined here (above post) to avoid circular imports — domain.ts would
 * need blogSchema from this file, and this file needs domain for the FK.
 */
import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, pgSchema, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';

export const blogSchema = pgSchema('blog');

/**
 * Translatable text per non-base locale.
 *   - `name` / `description` are EN canonical (NOT NULL).
 *   - `nameI18n` / `descriptionI18n` carry de/ru only; resolved at read via `tc()`.
 *   - No drift-tracking metadata: translations are author-edited (Claude updates
 *     all locales in one edit, not via a translation pipeline).
 */
export type DomainTextI18n = Partial<Record<'de' | 'ru', string>>;

export const domain = blogSchema.table(
	'domain',
	{
		id: text('id').primaryKey(),
		slug: text('slug').notNull(),
		name: text('name').notNull(),
		icon: text('icon'),
		color: integer('color'),
		description: text('description'),
		nameI18n: jsonb('name_i18n').$type<DomainTextI18n>().notNull().default(sql`'{}'::jsonb`),
		descriptionI18n: jsonb('description_i18n').$type<DomainTextI18n>().notNull().default(sql`'{}'::jsonb`),
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
		coverImageId: text('cover_image_id'),
		domainId: text('domain_id').references(() => domain.id, { onDelete: 'set null' }),
		/** Parent folder (nullable = root level under virtual:blog). FK defined below to avoid circular imports. */
		folderId: text('folder_id'),
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
		index('blog_post_domain_idx').on(table.domainId),
		index('blog_post_author_folder_idx').on(table.authorId, table.folderId),
	],
);
