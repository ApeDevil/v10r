/**
 * BLOG REVISION — Immutable content snapshots.
 * Revisions are never modified, only created. Rendered HTML is cached
 * at save time. search_vector is a GENERATED STORED column added via
 * raw SQL migration (Drizzle doesn't support generated columns).
 */
import { check, index, integer, jsonb, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from '../auth/_better-auth';
import { blogSchema, post } from './post';

export const revision = blogSchema.table(
	'revision',
	{
		id: text('id').primaryKey(),
		postId: text('post_id')
			.notNull()
			.references(() => post.id, { onDelete: 'cascade' }),
		revisionNumber: integer('revision_number').notNull(),
		title: text('title').notNull(),
		summary: text('summary'),
		markdown: text('markdown').notNull(),
		locale: text('locale').notNull().default('en'),
		renderedHtml: text('rendered_html'),
		embedDescriptors: jsonb('embed_descriptors'),
		contentHash: text('content_hash').notNull(),
		authorId: text('author_id').references(() => user.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('blog_revision_post_created_idx').on(table.postId, table.createdAt.desc()),
		index('blog_revision_post_locale_created_idx').on(
			table.postId,
			table.locale,
			table.createdAt.desc(),
		),
		uniqueIndex('blog_revision_post_locale_number_idx').on(
			table.postId,
			table.locale,
			table.revisionNumber,
		),
		index('blog_revision_author_idx').on(table.authorId),
		check('locale_format', sql`${table.locale} ~ '^[a-z]{2}(-[A-Z]{2})?$'`),
	],
);
