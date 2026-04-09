/**
 * CHUNK — Text segments with embeddings for retrieval.
 * Supports hierarchical parent-child (sentence < paragraph < section),
 * contextual metadata (Anthropic's prepended context approach),
 * full-text search (tsvector via migration), and vector similarity (pgvector HNSW).
 */

import { sql } from 'drizzle-orm';
import { type AnyPgColumn, index, integer, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { vector } from './_custom-types';
import { document } from './document';
import { embeddingModel, ragSchema } from './embedding-model';

export const chunkLevelEnum = ragSchema.enum('chunk_level', ['sentence', 'paragraph', 'section']);

export const chunk = ragSchema.table(
	'chunk',
	{
		id: text('id').primaryKey(),
		documentId: text('document_id')
			.notNull()
			.references(() => document.id, { onDelete: 'cascade' }),
		parentId: text('parent_id').references((): AnyPgColumn => chunk.id, { onDelete: 'cascade' }),
		level: chunkLevelEnum('level').notNull(),
		position: integer('position').notNull(),
		content: text('content').notNull(),
		contextPrefix: text('context_prefix'),
		tokenCount: integer('token_count').notNull(),
		contentHash: text('content_hash').notNull(),
		overlapPrev: integer('overlap_prev').notNull().default(0),
		overlapNext: integer('overlap_next').notNull().default(0),
		embeddingModelId: text('embedding_model_id').references(() => embeddingModel.id, { onDelete: 'restrict' }),
		embedding: vector(1536)('embedding'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('chunk_document_idx').on(table.documentId),
		index('chunk_parent_idx').on(table.parentId),
		index('chunk_doc_level_pos_idx').on(table.documentId, table.level, table.position),
		uniqueIndex('chunk_doc_hash_level_idx').on(table.documentId, table.contentHash, table.level),
		index('chunk_embedding_model_idx').on(table.embeddingModelId),
		index('chunk_children_idx').on(table.parentId, table.position).where(sql`parent_id IS NOT NULL`),
	],
);
