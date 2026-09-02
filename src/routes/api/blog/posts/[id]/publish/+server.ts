import * as v from 'valibot';
import { getLatestRevision, getPostById, publishRevision } from '$lib/server/blog';
import { PublishSchema } from '$lib/server/blog/schemas';
import { guardApiBlogAuthor, guardPostOwnership } from '$lib/server/http/guards';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiError, apiOk } from '$lib/server/http/response';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:blog:publish', 10, '1 m');

/** Publish the latest revision for a post. */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const guard = guardApiBlogAuthor(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const owned = guardPostOwnership(await getPostById(params.id), user);
	if ('error' in owned) return owned.error;

	const body = await request.json().catch(() => ({}));
	const parsed = v.safeParse(PublishSchema, body);
	const locale = parsed.success ? (parsed.output.locale ?? 'en') : 'en';

	const rev = await getLatestRevision(params.id, locale);
	if (!rev) return apiError(400, 'no_revisions', 'Post has no revisions to publish');

	await publishRevision(params.id, locale, rev.id);

	return apiOk({ revisionId: rev.id });
};
