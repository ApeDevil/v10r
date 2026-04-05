import * as v from 'valibot';
import { requireApiAuthor } from '$lib/server/auth/guards';
import { createAsset } from '$lib/server/blog';
import { ConfirmUploadSchema } from '$lib/server/blog/schemas';
import { confirmBlogUpload } from '$lib/server/store/blog';
import { classifyS3Error } from '$lib/server/store/errors';
import { apiCreated, apiError, apiValidationError } from '$lib/server/api/response';
import type { RequestHandler } from './$types';

/** Confirm an upload and create the DB record (step 3 of 3-step upload). */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = requireApiAuthor(locals);

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Request body must be valid JSON.');

	const parsed = v.safeParse(ConfirmUploadSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	const { key, fileName, mimeType, fileSize, width, height, altText } = parsed.output;

	try {
		await confirmBlogUpload(key);

		const asset = await createAsset({
			uploaderId: user.id,
			fileName,
			mimeType,
			fileSize,
			storageKey: key,
			altText,
			width,
			height,
		});

		return apiCreated({ asset });
	} catch (err) {
		const storeErr = classifyS3Error(err);
		return apiError(storeErr.toStatus(), 'storage_error', storeErr.message);
	}
};
