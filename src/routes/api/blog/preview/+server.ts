import { json, error } from '@sveltejs/kit';
import { requireApiAuthor } from '$lib/server/auth/guards';
import { renderBlogPost } from '$lib/server/blog';
import type { RequestHandler } from './$types';

const MAX_MARKDOWN_SIZE = 500_000;

/** Render markdown preview (server-side pipeline). */
export const POST: RequestHandler = async ({ request, locals }) => {
	requireApiAuthor(locals);

	const body = await request.json();
	const markdown = body.markdown as string;

	if (typeof markdown !== 'string') error(400, 'Markdown content is required');
	if (markdown.length > MAX_MARKDOWN_SIZE) error(413, 'Content too large');

	try {
		const result = await renderBlogPost(markdown);
		return json({
			html: result.html,
			embeds: result.embeds,
			toc: result.toc,
		});
	} catch {
		error(500, 'Preview rendering failed');
	}
};
