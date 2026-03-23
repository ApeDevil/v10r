import { json, error } from '@sveltejs/kit';
import { requireApiAuthor, requirePostOwnership } from '$lib/server/auth/guards';
import { getPostById, getLatestRevision, getTagsForPost } from '$lib/server/blog';
import type { RequestHandler } from './$types';

/** Get post + latest revision for editing. */
export const GET: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiAuthor(locals);

	const post = await getPostById(params.id);
	requirePostOwnership(post, user);

	const latestRevision = await getLatestRevision(params.id);
	const tags = await getTagsForPost(params.id);

	return json({
		post,
		latestRevision,
		tags,
	});
};
