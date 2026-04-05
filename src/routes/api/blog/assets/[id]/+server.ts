import { error, json } from '@sveltejs/kit';
import { requireApiAuthor } from '$lib/server/auth/guards';
import { deleteAsset, getAssetById, updateAssetMetadata } from '$lib/server/blog';
import { deleteBlogObject, generateBlogDownloadUrl } from '$lib/server/store/blog';
import { classifyS3Error } from '$lib/server/store/errors';
import type { RequestHandler } from './$types';

/** Get asset detail with download URL. */
export const GET: RequestHandler = async ({ params, locals }) => {
	requireApiAuthor(locals);

	const asset = await getAssetById(params.id);
	if (!asset) error(404, 'Asset not found');

	let downloadUrl: string | null = null;
	try {
		const result = await generateBlogDownloadUrl(asset.storageKey, 3600);
		downloadUrl = result.url;
	} catch {
		// R2 not configured
	}

	return json({ asset: { ...asset, downloadUrl } });
};

/** Update asset metadata (alt text, dimensions). */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	requireApiAuthor(locals);

	const asset = await getAssetById(params.id);
	if (!asset) error(404, 'Asset not found');

	const body = await request.json();
	const data: { altText?: string; width?: number; height?: number; fileName?: string } = {};

	if ('altText' in body) data.altText = body.altText as string;
	if ('width' in body) data.width = body.width as number;
	if ('height' in body) data.height = body.height as number;
	if ('fileName' in body) data.fileName = body.fileName as string;

	const updated = await updateAssetMetadata(params.id, data);
	return json({ asset: updated });
};

/** Delete asset from R2 and DB. */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	requireApiAuthor(locals);

	const asset = await getAssetById(params.id);
	if (!asset) error(404, 'Asset not found');

	// Delete from R2 first
	try {
		await deleteBlogObject(asset.storageKey);
	} catch (err) {
		const storeErr = classifyS3Error(err);
		// If not found in R2, still proceed with DB cleanup
		if (storeErr.kind !== 'not_found') {
			error(storeErr.toStatus(), storeErr.message);
		}
	}

	// Delete from DB (will fail with FK RESTRICT if still linked to posts)
	try {
		await deleteAsset(params.id);
	} catch (err) {
		error(409, 'Asset is still linked to posts. Unlink it first.');
	}

	return json({ success: true });
};
