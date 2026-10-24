import { redirect } from '@sveltejs/kit';
import { ipLimitKey } from '#lib/server/abuse/index.ts';
import { getPublicAssetById } from '#lib/server/blog/index.ts';
import { createLimiter, rateLimitResponse } from '#lib/server/http/rate-limit.ts';
import { apiError } from '#lib/server/http/response.ts';
import { generatePublicBlogImageUrl, PUBLIC_BLOG_IMAGE_CACHE_CONTROL } from '#lib/server/store/blog/index.ts';
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
 * Cache-Control: the 302 is cached by the browser and by Vercel's CDN, so repeat
 * views skip the function, the DB read and the presign entirely. The presigned URL
 * outlives every cache that may serve the redirect — see
 * `PUBLIC_BLOG_IMAGE_CACHE_CONTROL` for the arithmetic.
 */
export const GET: RequestHandler = async ({ params, setHeaders, locals }) => {
	const { success, reset } = await limiter.limit(ipLimitKey(locals.clientIp));
	if (!success) return rateLimitResponse(reset);

	const asset = await getPublicAssetById(params.id);
	// Same 404 whether it is missing or merely unpublished — distinguishing the
	// two would confirm the existence of unpublished assets.
	if (!asset) return apiError(404, 'not_found', 'Asset not found.');

	let url: string;
	try {
		const result = await generatePublicBlogImageUrl(asset.storageKey);
		url = result.url;
	} catch {
		return apiError(502, 'storage_unavailable', 'Storage unavailable.');
	}

	// Shared-cacheable because the asset hangs off a published post. Every refusal above
	// carries no Cache-Control, so `securityHeaders` stamps it `no-store, private`.
	setHeaders({ 'Cache-Control': PUBLIC_BLOG_IMAGE_CACHE_CONTROL });

	// Cross-origin (the R2 bucket host), which SvelteKit 3 refuses unless told. The URL is one
	// our store signed from server config, never request input.
	redirect(302, url, { external: true });
};
