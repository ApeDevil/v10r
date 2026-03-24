import { error, redirect } from '@sveltejs/kit';
import { getAssetById } from '$lib/server/blog';
import { generateBlogDownloadUrl } from '$lib/server/store/blog';
import type { RequestHandler } from './$types';

/**
 * Public image proxy — redirects to a fresh presigned R2 URL.
 * Used in blog markdown so image URLs never expire.
 *
 * Cache-Control: the redirect itself is short-lived (5 min),
 * but the presigned URL is valid for 1 hour.
 */
export const GET: RequestHandler = async ({ params, setHeaders }) => {
	const asset = await getAssetById(params.id);
	if (!asset) error(404, 'Asset not found');

	let url: string;
	try {
		const result = await generateBlogDownloadUrl(asset.storageKey, 3600);
		url = result.url;
	} catch {
		return error(502, 'Storage unavailable');
	}

	setHeaders({
		'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
	});

	redirect(302, url);
};
