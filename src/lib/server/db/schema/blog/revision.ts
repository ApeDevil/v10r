/**
 * BLOG REVISION — Immutable content snapshots.
 * Revisions are never modified, only created. Rendered HTML is cached at save
 * time. `search_vector` is an app-populated (NOT generated) tsvector written on
 * insert in `createRevision()` with a per-locale `regconfig` — Neon rejects the
 * non-immutable multi-field/per-locale expression in a generated column (42P17),
 * so it mirrors `rag.llmwiki_page`. The GIN index below makes `@@` queries fast.
 */

import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
import { tsvector } from '../rag/_custom-types';
import { post } from './post';
import { blogSchema } from './schema';

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
		/**
		 * For non-EN revisions of file-managed posts: the EN source's contentHash at the time
		 * this translation was authored. Drives staleness detection in `bun run content:check`.
		 * NULL for EN revisions and for any pre-existing (admin-authored) revision.
		 */
		sourceContentHash: text('source_content_hash'),
		/**
		 * Provenance tag: 'human' | 'claude-code' | NULL.
		 * NULL for EN and pre-existing revisions; 'claude-code' set by translation-loop authoring.
		 */
		translatedBy: text('translated_by'),
		authorId: text('author_id').references(() => user.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		/**
		 * Full-text search vector over title (A) + summary (B) + markdown (C),
		 * built with the revision's per-locale `regconfig`. App-populated on insert
		 * (see `createRevision`); NOT a generated column (42P17 on Neon).
		 */
		searchVector: tsvector('search_vector'),
	},
	(table) => [
		index('blog_revision_post_created_idx').on(table.postId, table.createdAt.desc()),
		index('blog_revision_post_locale_created_idx').on(table.postId, table.locale, table.createdAt.desc()),
		uniqueIndex('blog_revision_post_locale_number_idx').on(table.postId, table.locale, table.revisionNumber),
		index('blog_revision_author_idx').on(table.authorId),
		index('blog_revision_search_vector_idx').using('gin', table.searchVector),
		check('locale_format', sql`${table.locale} ~ '^[a-z]{2}(-[A-Z]{2})?$'`),
	],
);
