import { redirect } from '@sveltejs/kit';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError } from '$lib/server/api/response';
import { getPublicAssetById } from '$lib/server/blog';
import { generateBlogDownloadUrl } from '$lib/server/store/blog';
import type { RequestHandler } from './$types';

// Unauthenticated and cost-bearing (a DB read plus an R2 presign per hit), so
// it carries its own bucket. Keyed on IP — there is no session here.
const limiter = createLimiter('rl:blog:asset-image', 60, '1 m');

/**
 * Public image proxy — redirects to a fresh presigned R2 URL.
 * Used in blog markdown so image URLs never expire.
 *
 * Resolves through `getPublicAssetById`, which requires the asset to hang off a
 * published post. The previous `getAssetById` applied no access filter at all,
 * so any asset id — drafts and other authors' uploads included — could be
 * presigned by an anonymous caller.
 *
 * Cache-Control: the redirect itself is short-lived (5 min),
 * but the presigned URL is valid for 1 hour.
 */
export const GET: RequestHandler = async ({ params, setHeaders, locals }) => {
	const { success, reset } = await limiter.limit(locals.clientIp ?? 'anon');
	if (!success) return rateLimitResponse(reset);

	const asset = await getPublicAssetById(params.id);
	// Same 404 whether it is missing or merely unpublished — distinguishing the
	// two would confirm the existence of unpublished assets.
	if (!asset) return apiError(404, 'not_found', 'Asset not found.');

	let url: string;
	try {
		const result = await generateBlogDownloadUrl(asset.storageKey, 3600);
		url = result.url;
	} catch {
		return apiError(502, 'storage_unavailable', 'Storage unavailable.');
	}

	setHeaders({
		'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
	});

	redirect(302, url);
};
