/**
 * LLMWIKI_PAGE_REDIRECT — stable slug-rename mapping.
 *
 * Slugs on llmwiki_page are immutable. When a user-facing rename is needed,
 * insert a row here so stale URLs and cached wikilinks redirect (308) to the
 * canonical new page. Collection-scoped to avoid cross-collection collision.
 */

import { index, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { collection } from './collection';
import { ragSchema } from './embedding-model';
import { llmwikiPage } from './llmwiki-page';

export const llmwikiPageRedirect = ragSchema.table(
	'llmwiki_page_redirect',
	{
		id: text('id').primaryKey(),
		collectionId: text('collection_id').references(() => collection.id, { onDelete: 'cascade' }),
		oldSlug: text('old_slug').notNull(),
		newPageId: text('new_page_id')
			.notNull()
			.references(() => llmwikiPage.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		uniqueIndex('llmwiki_redirect_slug_uq').on(t.collectionId, t.oldSlug),
		index('llmwiki_redirect_new_page_idx').on(t.newPageId),
	],
);
