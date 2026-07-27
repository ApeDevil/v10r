import * as v from 'valibot';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError, apiNoContent, apiValidationError } from '$lib/server/api/response';
import { guardApiBlogAuthor, guardPostOwnership } from '$lib/server/auth/guards';
import { getPostById, setPostTags } from '$lib/server/blog';
import { SetTagsSchema } from '$lib/server/blog/schemas';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:blog:tags', 30, '1 m');

/** Set tags for a post. */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const guard = guardApiBlogAuthor(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const owned = guardPostOwnership(await getPostById(params.id), user);
	if ('error' in owned) return owned.error;

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Request body must be valid JSON.');

	const parsed = v.safeParse(SetTagsSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	await setPostTags(params.id, parsed.output.tagIds);
	return apiNoContent();
};
