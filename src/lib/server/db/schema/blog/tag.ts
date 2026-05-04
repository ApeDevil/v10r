/**
 * BLOG TAG + POST_TAG — Lightweight taxonomy.
 * Tags have no timestamps or soft delete. post_tag is a junction table.
 */
import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, primaryKey, text, uniqueIndex } from 'drizzle-orm/pg-core';
import type { TranslationMap } from '$lib/i18n/content';
import { blogSchema, post } from './post';

export const tag = blogSchema.table(
	'tag',
	{
		id: text('id').primaryKey(),
		slug: text('slug').notNull(),
		name: text('name').notNull(),
		nameI18n: jsonb('name_i18n').$type<TranslationMap>().notNull().default(sql`'{}'::jsonb`),
		icon: text('icon'),
		color: integer('color'),
		glyph: text('glyph'),
	},
	(table) => [
		uniqueIndex('blog_tag_slug_idx').on(table.slug),
		check('tag_slug_format', sql`${table.slug} ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'`),
		check('tag_color_range', sql`${table.color} IS NULL OR (${table.color} >= 1 AND ${table.color} <= 8)`),
	],
);

export const postTag = blogSchema.table(
	'post_tag',
	{
		postId: text('post_id')
			.notNull()
			.references(() => post.id, { onDelete: 'cascade' }),
		tagId: text('tag_id')
			.notNull()
			.references(() => tag.id, { onDelete: 'cascade' }),
	},
	(table) => [primaryKey({ columns: [table.postId, table.tagId] }), index('blog_post_tag_tag_idx').on(table.tagId)],
);
