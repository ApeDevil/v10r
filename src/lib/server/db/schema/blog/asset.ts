/**
 * BLOG ASSET + POST_ASSET — File metadata (blobs in R2).
 * Assets survive user deletion (SET NULL on uploader).
 * post_asset uses RESTRICT to prevent deleting in-use assets.
 */
import { sql } from 'drizzle-orm';
import { check, index, integer, primaryKey, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
import { assetFolder } from './asset-folder';
import { post } from './post';
import { blogSchema } from './schema';

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
		/** Parent folder (nullable = root under virtual:assets). Deleting a folder orphans assets to root (SET NULL). */
		folderId: text('folder_id').references(() => assetFolder.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex('blog_asset_storage_key_idx').on(table.storageKey),
		index('blog_asset_uploader_idx').on(table.uploaderId),
		index('blog_asset_uploader_folder_idx').on(table.uploaderId, table.folderId),
		// Single-column FK index backs the ON DELETE SET NULL scan on folder delete.
		index('blog_asset_folder_idx').on(table.folderId),
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
