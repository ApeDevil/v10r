import { json, error } from '@sveltejs/kit';
import { requireApiAuthor } from '$lib/server/auth/guards';
import { createAsset } from '$lib/server/blog';
import { confirmBlogUpload } from '$lib/server/store/blog';
import { classifyS3Error } from '$lib/server/store/errors';
import type { RequestHandler } from './$types';

/** Confirm an upload and create the DB record (step 3 of 3-step upload). */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = requireApiAuthor(locals);
	const body = await request.json();

	const key = body.key as string;
	const fileName = body.fileName as string;
	const mimeType = body.mimeType as string;
	const fileSize = body.fileSize as number;
	const width = (body.width as number) || undefined;
	const height = (body.height as number) || undefined;
	const altText = (body.altText as string) || undefined;

	if (!key || !fileName || !mimeType || !fileSize) {
		error(400, 'key, fileName, mimeType, and fileSize are required');
	}

	try {
		// Verify object exists in R2
		await confirmBlogUpload(key);

		// Create DB record
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

		return json({ asset }, { status: 201 });
	} catch (err) {
		const storeErr = classifyS3Error(err);
		error(storeErr.toStatus(), storeErr.message);
	}
};
