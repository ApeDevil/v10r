/**
 * PUBLISHED REVISION — Locale-aware publish pointers.
 * One published revision per (post, locale) pair.
 * Publishing a new revision for a locale is an UPSERT.
 */
import { index, primaryKey, text } from 'drizzle-orm/pg-core';
import { blogSchema, post } from './post';
import { revision } from './revision';

export const publishedRevision = blogSchema.table(
	'published_revision',
	{
		postId: text('post_id')
			.notNull()
			.references(() => post.id, { onDelete: 'cascade' }),
		locale: text('locale').notNull(),
		revisionId: text('revision_id')
			.notNull()
			.references(() => revision.id, { onDelete: 'restrict' }),
	},
	(table) => [
		primaryKey({ columns: [table.postId, table.locale] }),
		index('blog_published_revision_idx').on(table.revisionId),
	],
);
