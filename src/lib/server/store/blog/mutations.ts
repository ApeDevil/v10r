import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { MAX_BLOG_UPLOAD_SIZE, MAX_BLOG_3D_UPLOAD_SIZE, PRESIGNED_URL_EXPIRY } from '$lib/server/config';
import { StoreError } from '../errors';
import { BUCKET, s3 } from '../index';
import type { PresignedUrlResult, UploadResult } from '../types';
import { assertBlogKey, BLOG_PREFIX, checkBlogObjectLimit } from './guards';

function requireS3() {
	if (!s3) throw new StoreError('credentials', 'R2 storage is not configured');
	return s3;
}

const ALLOWED_MIME_TYPES = [
	'image/png',
	'image/jpeg',
	'image/gif',
	'image/webp',
	'image/svg+xml',
	'model/gltf-binary',
];

/**
 * Generate a presigned PUT URL for direct browser upload.
 * Content-Type is locked into the signature — the client must send the same type.
 */
export async function generateBlogUploadUrl(
	fileName: string,
	mimeType: string,
	fileSize: number,
): Promise<PresignedUrlResult & { key: string }> {
	const client = requireS3();

	if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
		throw new StoreError(
			'forbidden',
			`File type "${mimeType}" is not allowed. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
		);
	}

	const is3D = mimeType.startsWith('model/');
	const maxSize = is3D ? MAX_BLOG_3D_UPLOAD_SIZE : MAX_BLOG_UPLOAD_SIZE;
	const maxSizeMB = maxSize / (1024 * 1024);

	if (fileSize > maxSize) {
		throw new StoreError(
			'limit',
			`File size ${(fileSize / 1024 / 1024).toFixed(1)} MB exceeds the ${maxSizeMB} MB limit`,
		);
	}

	const limitMsg = await checkBlogObjectLimit();
	if (limitMsg) {
		throw new StoreError('limit', limitMsg);
	}

	const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : 'bin';
	const key = `${BLOG_PREFIX}${crypto.randomUUID()}.${ext}`;

	const command = new PutObjectCommand({
		Bucket: BUCKET,
		Key: key,
		ContentType: mimeType,
	});

	const url = await getSignedUrl(client, command, { expiresIn: PRESIGNED_URL_EXPIRY });

	return {
		url,
		key,
		expiresIn: PRESIGNED_URL_EXPIRY,
		expiresAt: new Date(Date.now() + PRESIGNED_URL_EXPIRY * 1000).toISOString(),
	};
}

/**
 * Confirm an upload by verifying the object exists via HeadObject.
 */
export async function confirmBlogUpload(key: string): Promise<UploadResult> {
	const client = requireS3();
	assertBlogKey(key);

	const res = await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));

	return {
		key,
		etag: res.ETag ?? '',
		size: res.ContentLength ?? 0,
		contentType: res.ContentType ?? 'unknown',
	};
}

/** Delete a single blog object from R2. */
export async function deleteBlogObject(key: string): Promise<void> {
	const client = requireS3();
	assertBlogKey(key);
	await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/** Blog MIME allowlist (exported for client-side validation). */
export const BLOG_ALLOWED_MIME_TYPES = ALLOWED_MIME_TYPES;
