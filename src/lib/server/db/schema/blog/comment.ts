/**
 * BLOG COMMENT — Signed-in user discussion on published posts.
 *
 * Per-locale: composite FK (post_id, locale) → published_revision enforces
 * "comments only on locales that were published at some point". On unpublish
 * (delete of published_revision row) cascade ON DELETE RESTRICT — admin
 * decides whether to hard-delete or hide the thread first.
 *
 * Idempotency: UNIQUE (author_id, post_id, client_nonce) lets POST retries
 * return the original row instead of creating a duplicate.
 *
 * Status: visible (default) | hidden (admin-suppressed, body retained) |
 * removed (admin-deleted, body cleared). Author self-delete uses deletedAt
 * (distinct from admin status flips so audit semantics stay clean).
 *
 * NO threading column in v1 — v2 ships parentId + API + UI together.
 */
import { sql } from 'drizzle-orm';
import { check, foreignKey, index, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
import { blogSchema } from './post';
import { publishedRevision } from './published-revision';

export const commentStatusEnum = blogSchema.enum('comment_status', ['visible', 'hidden', 'removed']);

export const comment = blogSchema.table(
	'comment',
	{
		id: text('id').primaryKey(),
		postId: text('post_id').notNull(),
		locale: text('locale').notNull(),
		authorId: text('author_id')
			.notNull()
			.references(() => user.id, { onDelete: 'restrict' }),
		body: text('body').notNull(),
		status: commentStatusEnum('status').notNull().default('visible'),
		clientNonce: text('client_nonce').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		editedAt: timestamp('edited_at', { withTimezone: true }),
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		hiddenAt: timestamp('hidden_at', { withTimezone: true }),
		hiddenBy: text('hidden_by').references(() => user.id, { onDelete: 'set null' }),
		hiddenReason: text('hidden_reason'),
	},
	(table) => [
		foreignKey({
			columns: [table.postId, table.locale],
			foreignColumns: [publishedRevision.postId, publishedRevision.locale],
			name: 'blog_comment_published_revision_fk',
		}).onDelete('restrict'),
		uniqueIndex('blog_comment_nonce_uniq').on(table.authorId, table.postId, table.clientNonce),
		index('blog_comment_feed_idx').on(table.postId, table.locale, table.createdAt.desc(), table.id.desc()),
		index('blog_comment_author_idx').on(table.authorId, table.createdAt.desc()),
		index('blog_comment_moderation_idx')
			.on(table.status, table.createdAt.desc())
			.where(sql`status IN ('hidden', 'removed')`),
		check('blog_comment_body_len', sql`char_length(${table.body}) BETWEEN 1 AND 4000`),
		check('blog_comment_locale_format', sql`${table.locale} ~ '^[a-z]{2}(-[A-Z]{2})?$'`),
	],
);
