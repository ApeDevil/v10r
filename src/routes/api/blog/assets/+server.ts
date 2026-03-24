import { json, error } from '@sveltejs/kit';
import { requireApiAuthor } from '$lib/server/auth/guards';
import { listAssets } from '$lib/server/blog';
import { generateBlogUploadUrl } from '$lib/server/store/blog';
import { generateBlogDownloadUrl } from '$lib/server/store/blog';
import { classifyS3Error } from '$lib/server/store/errors';
import type { RequestHandler } from './$types';

/** List all assets for the current author, with download URLs. */
export const GET: RequestHandler = async ({ locals }) => {
	const { user } = requireApiAuthor(locals);

	const assets = await listAssets(user.id);

	const items = await Promise.all(
		assets.map(async (a) => {
			let downloadUrl: string | null = null;
			try {
				const result = await generateBlogDownloadUrl(a.storageKey, 3600);
				downloadUrl = result.url;
			} catch {
				// R2 may not be configured — graceful degradation
			}
			return { ...a, downloadUrl };
		}),
	);

	return json({ items });
};

/** Request a presigned upload URL (step 1 of 3-step upload). */
export const POST: RequestHandler = async ({ request, locals }) => {
	requireApiAuthor(locals);

	const body = await request.json();
	const fileName = body.fileName as string;
	const mimeType = body.mimeType as string;
	const fileSize = body.fileSize as number;

	if (!fileName || !mimeType || !fileSize) {
		error(400, 'fileName, mimeType, and fileSize are required');
	}

	try {
		const result = await generateBlogUploadUrl(fileName, mimeType, fileSize);
		return json({ upload: result });
	} catch (err) {
		const storeErr = classifyS3Error(err);
		error(storeErr.toStatus(), storeErr.message);
	}
};
