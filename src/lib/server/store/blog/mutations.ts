import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SUBKEY_PURPOSES } from '$lib/server/security/subkey';
import { signTicket, verifyTicket } from '$lib/server/security/ticket';
import { MAX_BLOG_3D_UPLOAD_SIZE, MAX_BLOG_UPLOAD_SIZE, PRESIGNED_URL_EXPIRY } from '../config';
import { StoreError } from '../errors';
import { BUCKET, s3 } from '../index';
import type { PresignedUrlResult, UploadResult } from '../types';
import { assertBlogKey, BLOG_PREFIX, checkBlogObjectLimit } from './guards';

function requireS3() {
	if (!s3) throw new StoreError('credentials', 'R2 storage is not configured');
	return s3;
}

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'model/gltf-binary'];

/**
 * How long a confirmation ticket stays valid.
 *
 * Deliberately LONGER than PRESIGNED_URL_EXPIRY. The presigned URL only has to
 * survive long enough to start the PUT; the ticket has to survive the whole
 * upload plus the confirm round trip. Matching the two would mean a slow but
 * entirely valid 4-minute upload finishing at 5:10 could never be confirmed,
 * leaving an object in the bucket with no row that will ever reference it.
 */
export const UPLOAD_TICKET_TTL_MS = 15 * 60 * 1000;

export interface UploadTicketClaims extends Record<string, string | number> {
	key: string;
	userId: string;
	fileName: string;
	mimeType: string;
	maxBytes: number;
}

/**
 * Verify a confirmation ticket against the session presenting it.
 *
 * Returns the claims fixed at issuance, so confirm can enforce the size limit
 * that actually applied — which it cannot otherwise know, because the limit
 * depends on the MIME type chosen at issuance.
 */
export function verifyUploadTicket(ticket: string, key: string, userId: string): UploadTicketClaims {
	const check = verifyTicket<UploadTicketClaims>(SUBKEY_PURPOSES.blogUploadTicket, ticket);
	if (!check.ok) {
		throw new StoreError(
			'forbidden',
			check.reason === 'expired'
				? 'This upload ticket has expired. Request a new upload URL and try again.'
				: 'Invalid upload ticket.',
		);
	}
	// The two facts worth binding: it was issued for THIS object, to THIS caller.
	// Without the second, any blog author could confirm another author's key and
	// — because storage_key is globally unique and first-write-wins — keep it.
	if (check.fields.key !== key || check.fields.userId !== userId) {
		throw new StoreError('forbidden', 'This upload ticket was not issued for this object.');
	}
	return check.fields;
}

export async function generateBlogUploadUrl(
	userId: string,
	fileName: string,
	mimeType: string,
	fileSize: number,
): Promise<PresignedUrlResult & { key: string; ticket: string }> {
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

	/**
	 * Bind the issuance to the caller. Nothing else does: the key is a bare UUID
	 * in a namespace shared by every blog author, and no record of "who was this
	 * issued to" existed anywhere.
	 *
	 * A ticket rather than a table, because this needs no DDL and nothing to
	 * clean up. `maxBytes` rides along because the limit depends on the MIME type
	 * chosen HERE, and confirm has no other way to learn which one applied — a
	 * presigned PUT cannot enforce Content-Length at all, so the size check has
	 * to happen at confirmation against the limit that was in force at issuance.
	 */
	const ticket = signTicket(
		SUBKEY_PURPOSES.blogUploadTicket,
		{ key, userId, fileName, mimeType, maxBytes: maxSize } satisfies UploadTicketClaims,
		Date.now() + UPLOAD_TICKET_TTL_MS,
	);

	return {
		url,
		key,
		ticket,
		expiresIn: PRESIGNED_URL_EXPIRY,
		expiresAt: new Date(Date.now() + PRESIGNED_URL_EXPIRY * 1000).toISOString(),
	};
}

/**
 * Confirm an upload by verifying the object exists via HeadObject.
 */
export async function confirmBlogUpload(key: string): Promise<UploadResult> {
	assertBlogKey(key);
	const client = requireS3();

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
	assertBlogKey(key);
	const client = requireS3();
	await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
