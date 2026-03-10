/**
 * COLLECTION — Groups of documents for scoped retrieval.
 * Documents can belong to multiple collections (N:M via junction table).
 */

import { sql } from 'drizzle-orm';
import { index, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
import { document } from './document';
import { ragSchema } from './embedding-model';

export const collection = ragSchema.table(
	'collection',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		description: text('description'),
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('collection_user_idx').on(table.userId),
		index('collection_active_idx').on(table.userId, table.name).where(sql`deleted_at IS NULL`),
	],
);

export const collectionDocument = ragSchema.table(
	'collection_document',
	{
		collectionId: text('collection_id')
			.notNull()
			.references(() => collection.id, { onDelete: 'cascade' }),
		documentId: text('document_id')
			.notNull()
			.references(() => document.id, { onDelete: 'cascade' }),
		addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		primaryKey({ columns: [table.collectionId, table.documentId] }),
		index('collection_document_doc_idx').on(table.documentId),
	],
);
