import { error, redirect } from '@sveltejs/kit';
import { generateBlogDownloadUrl } from '$lib/server/store/blog';
import type { RequestHandler } from './$types';

/**
 * Public media proxy by storage key — redirects to a fresh presigned R2 URL.
 * Used to fix legacy blog content that embedded presigned URLs directly.
 *
 * URL pattern: /api/blog/media/blog/uuid.ext
 * The [...path] param becomes the R2 storage key.
 */
export const GET: RequestHandler = async ({ params, setHeaders }) => {
	const key = params.path;
	if (!key || !key.startsWith('blog/')) {
		error(400, 'Invalid storage key');
	}

	let url: string;
	try {
		const result = await generateBlogDownloadUrl(key, 3600);
		url = result.url;
	} catch {
		return error(502, 'Storage unavailable');
	}

	setHeaders({
		'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
	});

	redirect(302, url);
};
