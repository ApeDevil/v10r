import { json, error } from '@sveltejs/kit';
import { requireApiAuthor, requirePostOwnership } from '$lib/server/auth/guards';
import { getPostById, setPostDomain } from '$lib/server/blog';
import type { RequestHandler } from './$types';

/** Set domain for a post. */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const { user } = requireApiAuthor(locals);

	const post = await getPostById(params.id);
	requirePostOwnership(post, user);

	const body = await request.json();
	const { domainId } = body;

	if (domainId !== null && (typeof domainId !== 'string' || !domainId.startsWith('dom_'))) {
		error(400, 'domainId must be a valid domain ID or null');
	}

	await setPostDomain(params.id, domainId);
	return json({ success: true });
};
