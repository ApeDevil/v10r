/**
 * R2 operations for the Image Kit showcase namespace (`showcase/imagekit/`).
 *
 * Sibling of `image.ts` (the Image Metadata Reader's store) but on a SEPARATE
 * prefix so the toolkit's EPHEMERAL objects can be lifecycle-expired (R2 TTL rule
 * on `showcase/imagekit/**`) independently of the reader's persisted images.
 *
 * Pure storage: put/read/sign/delete bytes. Image *processing* (resize + EXIF
 * strip) is reused from the imagemeta domain — this module only ever sees an
 * already-sanitised WebP derivative.
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

export const IMAGEKIT_PREFIX = 'showcase/imagekit/';

/** Ensure a key is within the imagekit namespace. */
export function assertImagekitKey(key: string): void {
	if (!key.startsWith(IMAGEKIT_PREFIX)) {
		throw new StoreError('forbidden', `Key must start with "${IMAGEKIT_PREFIX}": ${key}`);
	}
}

/** Build a per-user object key for an ephemeral image derivative. */
export function buildImagekitKey(userId: string, imageId: string, ext: string): string {
	return `${IMAGEKIT_PREFIX}${userId}/${imageId}.${ext}`;
}

/** Store an already-processed (resized, EXIF-stripped) image derivative. */
export async function putImagekitDerivative(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
	assertImagekitKey(key);
	const client = requireS3();
	try {
		await client.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: bytes, ContentType: contentType }));
	} catch (err) {
		throw classifyS3Error(err);
	}
}

/** Read an image's bytes back (e.g. to hand to a vision model or to crop). */
export async function getImagekitBytes(key: string): Promise<Uint8Array> {
	assertImagekitKey(key);
	const client = requireS3();
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
export async function getImagekitReadUrl(key: string, expiresIn = PRESIGNED_URL_EXPIRY): Promise<string> {
	assertImagekitKey(key);
	const client = requireS3();
	try {
		return await getSignedUrl(client, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn });
	} catch (err) {
		throw classifyS3Error(err);
	}
}

/** Delete a stored ephemeral image derivative (fired on Approve/discard). */
export async function deleteImagekitObject(key: string): Promise<void> {
	assertImagekitKey(key);
	const client = requireS3();
	try {
		await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
	} catch (err) {
		throw classifyS3Error(err);
	}
}
