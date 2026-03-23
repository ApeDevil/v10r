import { json, error } from '@sveltejs/kit';
import { requireApiAuthor, requirePostOwnership } from '$lib/server/auth/guards';
import { getPostById, createRevision } from '$lib/server/blog';
import type { RequestHandler } from './$types';

const MAX_MARKDOWN_SIZE = 500_000;

/** Save a new revision. */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const { user } = requireApiAuthor(locals);

	const post = await getPostById(params.id);
	requirePostOwnership(post, user);

	const body = await request.json();

	const title = (body.title as string)?.trim();
	const summary = (body.summary as string)?.trim() || undefined;
	const markdown = body.markdown as string;
	const locale = (body.locale as string)?.trim() || 'en';

	if (!title) error(400, 'Title is required');
	if (typeof markdown !== 'string') error(400, 'Markdown content is required');
	if (markdown.length > MAX_MARKDOWN_SIZE) error(413, 'Content too large');

	const revision = await createRevision(params.id, {
		title,
		summary,
		markdown,
		locale,
		authorId: user.id,
	});

	return json({ revision }, { status: 201 });
};
