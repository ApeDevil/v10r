/**
 * BLOG ASSET + POST_ASSET — File metadata (blobs in R2).
 * Assets survive user deletion (SET NULL on uploader).
 * post_asset uses RESTRICT to prevent deleting in-use assets.
 */
import { sql } from 'drizzle-orm';
import { check, foreignKey, index, integer, primaryKey, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
import { blogSchema, post } from './post';

export const asset = blogSchema.table(
	'asset',
	{
		id: text('id').primaryKey(),
		uploaderId: text('uploader_id').references(() => user.id, { onDelete: 'set null' }),
		fileName: text('file_name').notNull(),
		mimeType: text('mime_type').notNull(),
		fileSize: integer('file_size').notNull(),
		storageKey: text('storage_key').notNull(),
		altText: text('alt_text'),
		width: integer('width'),
		height: integer('height'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex('blog_asset_storage_key_idx').on(table.storageKey),
		index('blog_asset_uploader_idx').on(table.uploaderId),
		check('file_size_positive', sql`${table.fileSize} > 0`),
	],
);

export const postAsset = blogSchema.table(
	'post_asset',
	{
		postId: text('post_id')
			.notNull()
			.references(() => post.id, { onDelete: 'cascade' }),
		assetId: text('asset_id')
			.notNull()
			.references(() => asset.id, { onDelete: 'restrict' }),
	},
	(table) => [
		primaryKey({ columns: [table.postId, table.assetId] }),
		index('blog_post_asset_asset_idx').on(table.assetId),
	],
);

/** FK from post.cover_image_id → asset.id (defined here to avoid circular import). */
export const postCoverImageFk = foreignKey({
	columns: [post.coverImageId],
	foreignColumns: [asset.id],
	name: 'blog_post_cover_image_fk',
}).onDelete('set null');
