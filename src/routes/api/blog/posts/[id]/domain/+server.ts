import * as v from 'valibot';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError, apiNoContent, apiValidationError } from '$lib/server/api/response';
import { requireApiAuthor, requirePostOwnership } from '$lib/server/auth/guards';
import { getPostById, setPostDomain } from '$lib/server/blog';
import { SetDomainSchema } from '$lib/server/blog/schemas';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:blog:domain', 30, '1 m');

/** Set domain for a post. */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const { user } = requireApiAuthor(locals);

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const post = await getPostById(params.id);
	requirePostOwnership(post, user);

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Request body must be valid JSON.');

	const parsed = v.safeParse(SetDomainSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	await setPostDomain(params.id, parsed.output.domainId);
	return apiNoContent();
};
