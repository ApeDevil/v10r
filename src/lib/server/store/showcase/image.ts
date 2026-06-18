/**
 * R2 operations for the Image Metadata Reader namespace (`showcase/imagemeta/`).
 *
 * Pure storage: put/read/sign/delete bytes. Image *processing* (resize + EXIF strip)
 * lives in the imagemeta domain (process.ts) — this module never sees an un-stripped
 * original; the domain hands it an already-sanitised derivative to store.
 */

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PRESIGNED_URL_EXPIRY } from '$lib/server/config';
import { classifyS3Error, StoreError } from '../errors';
import { BUCKET, s3 } from '../index';

function requireS3() {
	if (!s3) throw new StoreError('credentials', 'R2 storage is not configured');
	return s3;
}

export const IMAGE_PREFIX = 'showcase/imagemeta/';

/** Ensure a key is within the imagemeta namespace. */
export function assertImageKey(key: string): void {
	if (!key.startsWith(IMAGE_PREFIX)) {
		throw new StoreError('forbidden', `Key must start with "${IMAGE_PREFIX}": ${key}`);
	}
}

/** Build a per-user object key for an image derivative. */
export function buildImageKey(userId: string, imageId: string, ext: string): string {
	return `${IMAGE_PREFIX}${userId}/${imageId}.${ext}`;
}

/** Store an already-processed (resized, EXIF-stripped) image derivative. */
export async function putImageDerivative(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
	const client = requireS3();
	assertImageKey(key);
	try {
		await client.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: bytes, ContentType: contentType }));
	} catch (err) {
		throw classifyS3Error(err);
	}
}

/** Read an image's bytes back (e.g. to hand to a vision model). */
export async function getImageBytes(key: string): Promise<Uint8Array> {
	const client = requireS3();
	assertImageKey(key);
	try {
		const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
		const bytes = await res.Body?.transformToByteArray();
		if (!bytes) throw new StoreError('not_found', `Empty object: ${key}`);
		return bytes;
	} catch (err) {
		throw classifyS3Error(err);
	}
}

/** Short-lived presigned GET URL for displaying the image in the browser. */
export async function getImageReadUrl(key: string, expiresIn = PRESIGNED_URL_EXPIRY): Promise<string> {
	const client = requireS3();
	assertImageKey(key);
	try {
		return await getSignedUrl(client, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn });
	} catch (err) {
		throw classifyS3Error(err);
	}
}

/** Delete a stored image derivative. */
export async function deleteImageObject(key: string): Promise<void> {
	const client = requireS3();
	assertImageKey(key);
	try {
		await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
	} catch (err) {
		throw classifyS3Error(err);
	}
}
