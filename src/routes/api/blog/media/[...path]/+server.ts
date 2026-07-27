import { redirect } from '@sveltejs/kit';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError } from '$lib/server/api/response';
import { getPublicAssetByStorageKey } from '$lib/server/blog';
import { generateBlogDownloadUrl } from '$lib/server/store/blog';
import type { RequestHandler } from './$types';

// Unauthenticated and cost-bearing, same as the by-id image proxy.
const limiter = createLimiter('rl:blog:media', 60, '1 m');

/**
 * Public media proxy by storage key — redirects to a fresh presigned R2 URL.
 * Used to fix legacy blog content that embedded presigned URLs directly.
 *
 * URL pattern: /api/blog/media/blog/uuid.ext
 * The [...path] param becomes the R2 storage key.
 *
 * The key must resolve to an asset attached to a published post. The prefix
 * check alone was not an access control: it accepted any `blog/`-prefixed
 * string and presigned it without ever consulting the database, so it could not
 * distinguish a real published asset from a draft's or a guessed key.
 */
export const GET: RequestHandler = async ({ params, setHeaders, locals }) => {
	const { success, reset } = await limiter.limit(locals.clientIp ?? 'anon');
	if (!success) return rateLimitResponse(reset);

	const key = params.path;
	if (!key || !key.startsWith('blog/')) {
		return apiError(400, 'invalid_key', 'Invalid storage key.');
	}

	const asset = await getPublicAssetByStorageKey(key);
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
