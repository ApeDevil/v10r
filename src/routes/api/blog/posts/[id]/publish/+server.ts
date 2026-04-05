import * as v from 'valibot';
import { requireApiAuthor, requirePostOwnership } from '$lib/server/auth/guards';
import { getPostById, getLatestRevision, publishRevision } from '$lib/server/blog';
import { PublishSchema } from '$lib/server/blog/schemas';
import { apiOk, apiError, apiValidationError } from '$lib/server/api/response';
import type { RequestHandler } from './$types';

/** Publish the latest revision for a post. */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const { user } = requireApiAuthor(locals);

	const post = await getPostById(params.id);
	requirePostOwnership(post, user);

	const body = await request.json().catch(() => ({}));
	const parsed = v.safeParse(PublishSchema, body);
	const locale = parsed.success ? (parsed.output.locale ?? 'en') : 'en';

	const rev = await getLatestRevision(params.id, locale);
	if (!rev) return apiError(400, 'no_revisions', 'Post has no revisions to publish');

	await publishRevision(params.id, locale, rev.id);

	return apiOk({ revisionId: rev.id });
};
