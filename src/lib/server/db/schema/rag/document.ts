/**
 * DOCUMENT — Source documents ingested into the RAG pipeline.
 * Soft-deletable. A document is the ingestion unit that gets chunked.
 */

import { sql } from 'drizzle-orm';
import { index, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
import { ragSchema } from './embedding-model';

export const documentSourceEnum = ragSchema.enum('document_source', ['upload', 'web', 'text', 'api']);

export const documentStatusEnum = ragSchema.enum('document_status', ['pending', 'processing', 'ready', 'error']);

export const document = ragSchema.table(
	'document',
	{
		id: text('id').primaryKey(),
		userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
		title: text('title').notNull(),
		source: documentSourceEnum('source').notNull(),
		sourceUri: text('source_uri'),
		mimeType: text('mime_type'),
		status: documentStatusEnum('status').notNull().default('pending'),
		totalChunks: integer('total_chunks').notNull().default(0),
		totalTokens: integer('total_tokens').notNull().default(0),
		errorMessage: text('error_message'),
		contentHash: text('content_hash').notNull(),
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('document_user_idx').on(table.userId),
		index('document_status_idx').on(table.status),
		index('document_content_hash_idx').on(table.contentHash),
		index('document_active_idx').on(table.createdAt).where(sql`deleted_at IS NULL`),
	],
);
