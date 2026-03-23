import { json, error } from '@sveltejs/kit';
import { requireApiAuthor, requirePostOwnership } from '$lib/server/auth/guards';
import { getPostById, setPostTags } from '$lib/server/blog';
import type { RequestHandler } from './$types';

/** Set tags for a post. */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const { user } = requireApiAuthor(locals);

	const post = await getPostById(params.id);
	requirePostOwnership(post, user);

	const body = await request.json();
	const tagIds = body.tagIds;

	if (!Array.isArray(tagIds) || tagIds.length > 50) error(400, 'tagIds must be an array (max 50)');
	if (!tagIds.every((id: unknown) => typeof id === 'string' && id.startsWith('tag_'))) {
		error(400, 'Invalid tag IDs');
	}

	await setPostTags(params.id, tagIds);
	return json({ success: true });
};
