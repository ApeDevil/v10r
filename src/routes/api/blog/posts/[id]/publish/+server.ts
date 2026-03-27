import { json, error } from '@sveltejs/kit';
import { requireApiAuthor, requirePostOwnership } from '$lib/server/auth/guards';
import { getPostById, getLatestRevision, publishRevision } from '$lib/server/blog';
import type { RequestHandler } from './$types';

/** Publish the latest revision for a post. */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const { user } = requireApiAuthor(locals);

	const post = await getPostById(params.id);
	requirePostOwnership(post, user);

	const body = await request.json().catch(() => ({}));
	const locale = (body.locale as string) || 'en';

	const rev = await getLatestRevision(params.id, locale);
	if (!rev) error(400, 'Post has no revisions to publish');

	await publishRevision(params.id, locale, rev.id);

	return json({ success: true, revisionId: rev.id });
};
