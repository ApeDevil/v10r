/**
 * LLMWIKI_PAGE — LLM-compiled knowledge pages.
 * Primary answer surface for chat. Each page is compiled from one or more
 * rawrag chunks (via the llmwiki_page_source junction) and carries:
 *   - title + tldr + tags (embedded together, 1536-dim)
 *   - body (BM25-searched; 'simple' dictionary preserves IDs/codes)
 *   - frontmatter (jsonb, structured metadata)
 *   - source_hash / compiled_at / stale (staleness tracking)
 *
 * Slugs are IMMUTABLE after creation — renames go through llmwiki_page_redirect.
 * One 'overview' page per collection (enforced by partial unique index).
 */

import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
import { tsvector, vector } from './_custom-types';
import { collection } from './collection';
import { ragSchema } from './embedding-model';

export const llmwikiPageKindEnum = ragSchema.enum('llmwiki_page_kind', ['overview', 'page']);

export interface LlmwikiFrontmatter {
	canonicalName?: string;
	counterarguments?: string[];
	dataGaps?: string[];
	lastReviewedAt?: string;
	[key: string]: unknown;
}

export const llmwikiPage = ragSchema.table(
	'llmwiki_page',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		collectionId: text('collection_id').references(() => collection.id, { onDelete: 'cascade' }),
		slug: text('slug').notNull(),
		kind: llmwikiPageKindEnum('kind').notNull().default('page'),
		title: text('title').notNull(),
		tldr: text('tldr').notNull(),
		tldrHash: text('tldr_hash').notNull(),
		body: text('body').notNull(),
		tags: text('tags').array().notNull().default(sql`ARRAY[]::text[]`),
		frontmatter: jsonb('frontmatter').$type<LlmwikiFrontmatter>().notNull().default({}),
		embedding: vector(1536)('embedding'),
		/**
		 * Full-text search vector over title + tldr + body + tags.
		 *
		 * NOT a generated column — Neon's PG rejects multi-field
		 * `to_tsvector(regconfig, …)` expressions in generated columns
		 * ("generation expression is not immutable", SQLSTATE 42P17).
		 * App code must populate this on insert/update via:
		 *   `to_tsvector('english', title || ' ' || tldr || ' ' || body || ' ' || tags_joined)`
		 * See `llmwiki/compile/` and `llmwiki/queries.ts`.
		 */
		searchVector: tsvector('search_vector'),
		sourceHash: text('source_hash').notNull(),
		sourceCount: integer('source_count').notNull().default(0),
		compiledAt: timestamp('compiled_at', { withTimezone: true }).notNull().defaultNow(),
		compiledByModel: text('compiled_by_model').notNull(),
		stale: boolean('stale').notNull().default(false),
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		uniqueIndex('llmwiki_page_slug_uq').on(t.collectionId, t.slug).where(sql`deleted_at IS NULL`),
		uniqueIndex('llmwiki_overview_uq')
			.on(t.collectionId)
			.where(sql`kind = 'overview' AND deleted_at IS NULL`),
		index('llmwiki_page_user_idx').on(t.userId),
		index('llmwiki_page_collection_idx').on(t.collectionId),
		index('llmwiki_page_stale_idx').on(t.stale).where(sql`stale = true AND deleted_at IS NULL`),
		index('llmwiki_page_embed_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
		index('llmwiki_page_fts_idx').using('gin', t.searchVector),
	],
);
