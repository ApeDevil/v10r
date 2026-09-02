import * as v from 'valibot';
import { createAsset } from '$lib/server/blog';
import { ConfirmUploadSchema } from '$lib/server/blog/schemas';
import { isUniqueViolation } from '$lib/server/db/shared/folder-tree';
import { guardApiBlogAuthor } from '$lib/server/http/guards';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiCreated, apiError, apiValidationError } from '$lib/server/http/response';
import { confirmBlogUpload, deleteBlogObject, verifyUploadTicket } from '$lib/server/store/blog';
import { classifyS3Error, StoreError } from '$lib/server/store/errors';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:blog:assets:confirm', 10, '1 m');

/** Confirm an upload and create the DB record (step 3 of 3-step upload). */
export const POST: RequestHandler = async ({ request, locals }) => {
	const guard = guardApiBlogAuthor(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Request body must be valid JSON.');

	const parsed = v.safeParse(ConfirmUploadSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	const { key, ticket, width, height, altText } = parsed.output;

	/**
	 * Prove this key was issued to THIS caller before touching storage.
	 *
	 * The blog-author grant alone is not enough: it would let any author confirm
	 * any `blog/<uuid>.<ext>` key, including one another author uploaded but has
	 * not yet confirmed. `storage_key` carries a global unique index and first
	 * write wins, so such a theft is permanent and the rightful uploader's own
	 * confirm comes back 409.
	 */
	let claims: ReturnType<typeof verifyUploadTicket>;
	try {
		claims = verifyUploadTicket(ticket, key, user.id);
	} catch (err) {
		if (err instanceof StoreError) return apiError(403, 'invalid_upload_ticket', err.message);
		throw err;
	}

	try {
		// The object itself is the authority on its own size and type — never the
		// request body. A presigned PUT signs Content-Type but never Content-Length,
		// so a caller can declare a small PNG and upload something else entirely.
		const head = await confirmBlogUpload(key);

		// Which limit applied was decided at issuance (3D models get a far larger
		// one), so it rides in on the ticket. Best-effort delete: a failure here
		// must not turn a 413 into a 500, and a concurrent confirm racing the
		// delete would otherwise surface as a spurious storage error.
		if (head.size > claims.maxBytes) {
			await deleteBlogObject(key).catch(() => {});
			return apiError(
				413,
				'payload_too_large',
				`Uploaded object is ${(head.size / 1024 / 1024).toFixed(1)} MB, over the ${claims.maxBytes / (1024 * 1024)} MB limit for ${claims.mimeType}.`,
			);
		}

		const asset = await createAsset({
			uploaderId: user.id,
			// From the ticket, not the request body — the name is fixed at issuance.
			fileName: claims.fileName,
			mimeType: head.contentType,
			fileSize: head.size,
			storageKey: key,
			altText,
			width,
			height,
		});

		return apiCreated({ asset });
	} catch (err) {
		// A repeat confirmation of the same key collides on the unique index over
		// `storage_key`; that is a client replay, not a storage fault, and must
		// not surface as a 500 from the S3 classifier.
		if (isUniqueViolation(err)) {
			return apiError(409, 'asset_already_confirmed', 'This upload has already been confirmed.');
		}
		const storeErr = classifyS3Error(err);
		return apiError(storeErr.toStatus(), 'storage_error', storeErr.message);
	}
};
