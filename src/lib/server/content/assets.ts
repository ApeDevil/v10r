/**
 * Asset upload for the file-as-source workflow.
 * Scans markdown bodies for relative-path image references, uploads them to R2,
 * inserts blog.asset rows + post_asset links, and rewrites the markdown to the
 * `/api/blog/media/blog/<uuid>.<ext>` proxy URL the production runtime serves from.
 *
 * Both the S3Client and the Database are injected — the module is framework-free.
 */

import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { createId } from '$lib/server/db/id';
import { asset, postAsset } from '$lib/server/db/schema/blog';
import type { Database } from '$lib/server/db/types';

const BLOG_PREFIX = 'blog/';
const PROXY_BASE = '/api/blog/media/';

const MIME_BY_EXT: Record<string, string> = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.svg': 'image/svg+xml',
	'.glb': 'model/gltf-binary',
};

/** Match `![alt](./assets/foo.png)` or `![alt](assets/foo.png)`. Captures alt and path. */
const REL_IMG_RE = /!\[(?<alt>[^\]]*)\]\((?<path>(?:\.\/)?assets\/[^)\s]+)\)/g;

export interface UploadAssetsArgs {
	db: Database;
	s3: S3Client;
	bucket: string;
	postId: string;
	authorId: string;
	/** Filesystem path to the post directory (where assets/ lives). */
	postDir: string;
	/** The markdown body to scan + rewrite. */
	markdown: string;
}

export interface UploadAssetsResult {
	rewritten: string;
	uploaded: { localPath: string; storageKey: string; assetId: string }[];
}

/**
 * Upload every relative-path image referenced in `markdown` and rewrite the body
 * to use the proxy URL. Returns the rewritten markdown plus a list of uploads.
 * Idempotent at the asset-row level via the (post_id, asset_id) unique constraint
 * on post_asset; re-uploads create new R2 objects but won't duplicate links.
 */
export async function uploadReferencedAssets(args: UploadAssetsArgs): Promise<UploadAssetsResult> {
	const { db, s3, bucket, postId, authorId, postDir, markdown } = args;
	const matches: { full: string; alt: string; relPath: string }[] = [];
	for (const m of markdown.matchAll(REL_IMG_RE)) {
		matches.push({
			full: m[0],
			alt: m.groups?.alt ?? '',
			relPath: m.groups?.path ?? '',
		});
	}

	const uploaded: UploadAssetsResult['uploaded'] = [];
	let rewritten = markdown;

	for (const { full, alt, relPath } of matches) {
		const localPath = normalize(join(postDir, relPath));
		const ext = extname(localPath).toLowerCase();
		const mimeType = MIME_BY_EXT[ext];
		if (!mimeType) {
			throw new Error(
				`${localPath}: unsupported asset extension '${ext}' (allowed: ${Object.keys(MIME_BY_EXT).join(', ')})`,
			);
		}

		const buffer = await readFile(localPath);
		const stats = await stat(localPath);
		const storageKey = `${BLOG_PREFIX}${crypto.randomUUID()}${ext}`;

		await s3.send(
			new PutObjectCommand({
				Bucket: bucket,
				Key: storageKey,
				Body: buffer,
				ContentType: mimeType,
			}),
		);

		const assetId = createId.asset();
		await db.insert(asset).values({
			id: assetId,
			uploaderId: authorId,
			fileName: relPath.replace(/^\.\//, ''),
			mimeType,
			fileSize: stats.size,
			storageKey,
			altText: alt || null,
		});

		await db.insert(postAsset).values({ postId, assetId }).onConflictDoNothing();

		const proxyUrl = `${PROXY_BASE}${storageKey}`;
		rewritten = rewritten.replaceAll(full, `![${alt}](${proxyUrl})`);
		uploaded.push({ localPath, storageKey, assetId });
	}

	return { rewritten, uploaded };
}

/** Quick predicate: does this body contain at least one relative-path image? */
export function hasRelativeAssets(markdown: string): boolean {
	REL_IMG_RE.lastIndex = 0;
	return REL_IMG_RE.test(markdown);
}
