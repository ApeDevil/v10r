/**
 * LLMWIKI_PAGE_LINK — wikilinks between llmwiki pages (`[[slug]]`).
 *
 * `toSlug` is always stored (may be a forward reference to an uncompiled
 * page). `toId` is nullable and backfilled when the target page exists.
 * The `broken` partial index powers lint's WIKI_BROKEN_WIKILINK detection.
 */

import { sql } from 'drizzle-orm';
import { type AnyPgColumn, index, primaryKey, text } from 'drizzle-orm/pg-core';
import { ragSchema } from './embedding-model';
import { llmwikiPage } from './llmwiki-page';

export const llmwikiPageLink = ragSchema.table(
	'llmwiki_page_link',
	{
		fromId: text('from_id')
			.notNull()
			.references(() => llmwikiPage.id, { onDelete: 'cascade' }),
		toSlug: text('to_slug').notNull(),
		toId: text('to_id').references((): AnyPgColumn => llmwikiPage.id, { onDelete: 'set null' }),
		anchor: text('anchor'),
	},
	(t) => [
		primaryKey({ columns: [t.fromId, t.toSlug] }),
		index('llmwiki_link_back_idx').on(t.toId),
		index('llmwiki_link_broken_idx').on(t.toSlug).where(sql`to_id IS NULL`),
	],
);
