import {
	PutObjectCommand,
	HeadObjectCommand,
	DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3, BUCKET } from '../index';
import { assertShowcaseKey, checkObjectLimit } from './guards';
import { StoreError } from '../errors';
import type { PresignedUrlResult, UploadResult } from '../types';

const UPLOAD_PREFIX = 'showcase/uploads/';
const MAX_UPLOAD_SIZE = 2 * 1024 * 1024; // 2 MB

const ALLOWED_MIME_TYPES = [
	'image/png',
	'image/jpeg',
	'image/gif',
	'image/webp',
	'image/svg+xml',
	'application/pdf',
];

/**
 * Generate a presigned PUT URL for direct browser upload.
 * Content-Type is locked into the signature — the client must send the same type.
 */
export async function generateUploadUrl(
	fileName: string,
	mimeType: string,
	fileSize: number,
): Promise<PresignedUrlResult & { key: string }> {
	// Validate MIME type
	if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
		throw new StoreError(
			'forbidden',
			`File type "${mimeType}" is not allowed. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
		);
	}

	// Validate size
	if (fileSize > MAX_UPLOAD_SIZE) {
		throw new StoreError(
			'limit',
			`File size ${(fileSize / 1024 / 1024).toFixed(1)} MB exceeds the 2 MB limit`,
		);
	}

	// Check showcase object limit
	const limitMsg = await checkObjectLimit();
	if (limitMsg) {
		throw new StoreError('limit', limitMsg);
	}

	// Generate key with UUID
	const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : 'bin';
	const key = `${UPLOAD_PREFIX}${crypto.randomUUID()}.${ext}`;

	const command = new PutObjectCommand({
		Bucket: BUCKET,
		Key: key,
		ContentType: mimeType,
	});

	const url = await getSignedUrl(s3, command, { expiresIn: 300 });

	return {
		url,
		key,
		expiresIn: 300,
		expiresAt: new Date(Date.now() + 300_000).toISOString(),
	};
}

/**
 * Confirm an upload by verifying the object exists via HeadObject.
 * Returns metadata about the uploaded object.
 */
export async function confirmUpload(key: string): Promise<UploadResult> {
	assertShowcaseKey(key);

	const res = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));

	return {
		key,
		etag: res.ETag ?? '',
		size: res.ContentLength ?? 0,
		contentType: res.ContentType ?? 'unknown',
	};
}

/** Delete a single showcase object. */
export async function deleteShowcaseObject(key: string): Promise<void> {
	assertShowcaseKey(key);
	await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
