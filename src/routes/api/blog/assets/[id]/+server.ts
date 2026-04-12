import * as v from 'valibot';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError, apiNoContent, apiOk, apiValidationError } from '$lib/server/api/response';
import { requireApiAuthor, requireAssetOwnership } from '$lib/server/auth/guards';
import { deleteAsset, getAssetById, updateAssetMetadata } from '$lib/server/blog';
import { PatchAssetSchema } from '$lib/server/blog/schemas';
import { deleteBlogObject, generateBlogDownloadUrl } from '$lib/server/store/blog';
import { classifyS3Error } from '$lib/server/store/errors';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:blog:assets:mutate', 30, '1 m');

/** Get asset detail with download URL. */
export const GET: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiAuthor(locals);

	const asset = await getAssetById(params.id);
	requireAssetOwnership(asset, user);

	let downloadUrl: string | null = null;
	try {
		const result = await generateBlogDownloadUrl(asset.storageKey, 3600);
		downloadUrl = result.url;
	} catch {
		// R2 not configured
	}

	return apiOk({ asset: { ...asset, downloadUrl } });
};

/** Update asset metadata (alt text, dimensions). */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const { user } = requireApiAuthor(locals);

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const asset = await getAssetById(params.id);
	requireAssetOwnership(asset, user);

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Request body must be valid JSON.');

	const parsed = v.safeParse(PatchAssetSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	const updated = await updateAssetMetadata(params.id, parsed.output);
	return apiOk({ asset: updated });
};

/** Delete asset from R2 and DB. */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiAuthor(locals);

	const { success: rlOk, reset } = await limiter.limit(user.id);
	if (!rlOk) return rateLimitResponse(reset);

	const asset = await getAssetById(params.id);
	requireAssetOwnership(asset, user);

	// Delete from R2 first
	try {
		await deleteBlogObject(asset.storageKey);
	} catch (err) {
		const storeErr = classifyS3Error(err);
		if (storeErr.kind !== 'not_found') {
			return apiError(storeErr.toStatus(), 'storage_error', storeErr.message);
		}
	}

	// Delete from DB (will fail with FK RESTRICT if still linked to posts)
	try {
		await deleteAsset(params.id);
	} catch {
		return apiError(409, 'asset_linked', 'Asset is still linked to posts. Unlink it first.');
	}

	return apiNoContent();
};
