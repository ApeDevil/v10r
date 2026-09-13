/**
 * CORPUS_MAP — the deterministic map of one collection's corpus: what it covers, built at
 * ingest from the documents themselves, never by a model.
 *
 * One row per collection. The chatbot injects the system docs corpus's map on every turn
 * (`<project-overview>`, the `project-map` capability) so the model can orient a broad
 * question without loading the corpus — a plain row read that works with the embedding
 * quota exhausted. `scripts/db/ingest-docs.ts` is its writer.
 */

import { index, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
import { collection } from './collection';
import { retrievalSchema } from './embedding-model';

export const corpusMap = retrievalSchema.table(
	'corpus_map',
	{
		id: text('id').primaryKey(),
		// Denormalized from the collection, like `chunk.user_id`: every retrieval read filters
		// on one owner column.
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		collectionId: text('collection_id')
			.notNull()
			.references(() => collection.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		body: text('body').notNull(),
		builtAt: timestamp('built_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [uniqueIndex('corpus_map_collection_uq').on(t.collectionId), index('corpus_map_user_idx').on(t.userId)],
);
