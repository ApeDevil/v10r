import * as v from 'valibot';
import { apiCreated, apiError, apiValidationError } from '$lib/server/api/response';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { requireApiAuthor, requirePostOwnership } from '$lib/server/auth/guards';
import { createRevision, getPostById } from '$lib/server/blog';
import { CreateRevisionSchema } from '$lib/server/blog/schemas';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:blog:revisions', 10, '1 m');

/** Save a new revision. */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const { user } = requireApiAuthor(locals);

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const post = await getPostById(params.id);
	requirePostOwnership(post, user);

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Request body must be valid JSON.');

	const parsed = v.safeParse(CreateRevisionSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	const revision = await createRevision(params.id, {
		...parsed.output,
		summary: parsed.output.summary || undefined,
		locale: parsed.output.locale ?? 'en',
		authorId: user.id,
	});

	return apiCreated({ revision });
};
