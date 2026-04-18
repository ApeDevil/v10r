/**
 * LLMWIKI_PAGE_SOURCE — junction linking each llmwiki page to the rawrag
 * chunks it was compiled from. The pointers surfaced on LlmwikiHit come
 * from this table.
 *
 * Carries `source_hash_at_compile` per chunk — powers both staleness
 * invalidation (join against current chunk.content_hash) and citation
 * verification (post-hoc hash match).
 *
 * `weight` is compile-time citation prominence — drives pointer ordering
 * when hydrating top-K pointers per page.
 */

import { index, primaryKey, real, text } from 'drizzle-orm/pg-core';
import { chunk } from './chunk';
import { document } from './document';
import { ragSchema } from './embedding-model';
import { llmwikiPage } from './llmwiki-page';

export const llmwikiPageSource = ragSchema.table(
	'llmwiki_page_source',
	{
		llmwikiPageId: text('llmwiki_page_id')
			.notNull()
			.references(() => llmwikiPage.id, { onDelete: 'cascade' }),
		chunkId: text('chunk_id')
			.notNull()
			.references(() => chunk.id, { onDelete: 'restrict' }),
		documentId: text('document_id')
			.notNull()
			.references(() => document.id, { onDelete: 'restrict' }),
		weight: real('weight').notNull().default(1.0),
		sourceHashAtCompile: text('source_hash_at_compile').notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.llmwikiPageId, t.chunkId] }),
		index('llmwiki_ps_doc_idx').on(t.documentId),
		index('llmwiki_ps_chunk_idx').on(t.chunkId),
		index('llmwiki_ps_page_weight_idx').on(t.llmwikiPageId, t.weight),
	],
);
