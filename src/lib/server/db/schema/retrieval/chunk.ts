/**
 * CHUNK — Text segments with embeddings for retrieval.
 * Supports hierarchical parent-child (sentence < paragraph < section),
 * contextual metadata (Anthropic's prepended context approach),
 * full-text search (generated tsvector + GIN), and vector similarity (pgvector HNSW).
 */

import { type SQL, sql } from 'drizzle-orm';
import { type AnyPgColumn, index, integer, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { tsvector, vector } from './_custom-types';
import { document } from './document';
import { embeddingModel, retrievalSchema } from './embedding-model';

// `sentence` is inert: `plan.ts` emits paragraph/section only and no row carries it. It stays in
// the TYPE because drizzle-kit recreates an enum by rewriting the column as text — a full rewrite
// of the 180 MB chunk table plus its HNSW index, which the Neon project's 512 MB cap refused
// (push attempt 4, 2026-09-19). Dropping it is an ALTER TYPE for a day the table is small again.
export const chunkLevelEnum = retrievalSchema.enum('chunk_level', ['sentence', 'paragraph', 'section']);

export const chunk = retrievalSchema.table(
	'chunk',
	{
		id: text('id').primaryKey(),
		documentId: text('document_id')
			.notNull()
			.references(() => document.id, { onDelete: 'cascade' }),
		/**
		 * Denormalized owner (copied from document.user_id at ingest). Lets vector
		 * + full-text retrieval filter the chunk row DIRECTLY instead of JOINing to
		 * document — which is what keeps the HNSW index usable (a join-side filter
		 * forces a seq scan + sort). Invariant: deleted/errored docs have no chunks
		 * (hard-deleted), so ownership is the only per-chunk gate retrieval needs.
		 */
		userId: text('user_id').notNull(),
		parentId: text('parent_id').references((): AnyPgColumn => chunk.id, { onDelete: 'cascade' }),
		level: chunkLevelEnum('level').notNull(),
		position: integer('position').notNull(),
		content: text('content').notNull(),
		contextPrefix: text('context_prefix'),
		tokenCount: integer('token_count').notNull(),
		contentHash: text('content_hash').notNull(),
		embeddingModelId: text('embedding_model_id').references(() => embeddingModel.id, { onDelete: 'restrict' }),
		embedding: vector(1536)('embedding'),
		/**
		 * Full-text search vector — generated from context_prefix + content.
		 * Column references use string-literal form to avoid TS hoisting
		 * and match Postgres's canonical stored expression.
		 */
		searchVector: tsvector('search_vector').generatedAlwaysAs(
			(): SQL => sql`to_tsvector('english', coalesce(context_prefix, '') || ' ' || content)`,
		),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('chunk_document_idx').on(table.documentId),
		index('chunk_user_idx').on(table.userId),
		index('chunk_parent_idx').on(table.parentId),
		index('chunk_doc_level_pos_idx').on(table.documentId, table.level, table.position),
		uniqueIndex('chunk_doc_hash_level_idx').on(table.documentId, table.contentHash, table.level),
		index('chunk_embedding_model_idx').on(table.embeddingModelId),
		index('chunk_children_idx').on(table.parentId, table.position).where(sql`parent_id IS NOT NULL`),
		index('chunk_search_vector_idx').using('gin', table.searchVector),
		/**
		 * Declared HERE, not in a post-push script: `db:push` reconciles indexes against
		 * this schema and drops the ones it does not know. The script-created copy of
		 * this index was lost that way, and every system-docs retrieve silently became a
		 * sequential scan over the whole embedding column — 7.7 s on a cold Neon compute
		 * (`scripts/perf/db-explain.ts`, 2026-09-11). Cosine ops to match `<=>` in
		 * `retrieval/tiers/contextual.ts`; pgvector's default m / ef_construction.
		 */
		index('chunk_embedding_hnsw_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
	],
);
