/**
 * BLOG FOLDER FKs — cross-file foreign keys defined outside their owning tables
 * to break circular imports.
 *
 * `post.folder_id → post_folder.id` and `asset.folder_id → asset_folder.id` use
 * `ON DELETE SET NULL`: deleting a folder orphans its contents to the root of
 * their respective virtual tree rather than cascading the delete. Recursive
 * delete at the domain layer handles the "delete folder and all contents" case.
 */
import { foreignKey } from 'drizzle-orm/pg-core';
import { asset } from './asset';
import { assetFolder } from './asset-folder';
import { post } from './post';
import { postFolder } from './post-folder';

export const postFolderFk = foreignKey({
	columns: [post.folderId],
	foreignColumns: [postFolder.id],
	name: 'blog_post_folder_fk',
}).onDelete('set null');

export const assetFolderFk = foreignKey({
	columns: [asset.folderId],
	foreignColumns: [assetFolder.id],
	name: 'blog_asset_folder_fk',
}).onDelete('set null');
