import * as v from 'valibot';
import { createRevision, getPostById } from '$lib/server/blog';
import { CreateRevisionSchema } from '$lib/server/blog/schemas';
import { guardApiBlogAuthor, guardPostOwnership } from '$lib/server/http/guards';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiCreated, apiError, apiValidationError } from '$lib/server/http/response';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:blog:revisions', 10, '1 m');

/** Save a new revision. */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const guard = guardApiBlogAuthor(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const owned = guardPostOwnership(await getPostById(params.id), user);
	if ('error' in owned) return owned.error;

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
