import * as v from 'valibot';
import { requireApiAuthor, requirePostOwnership } from '$lib/server/auth/guards';
import { getPostById, createRevision } from '$lib/server/blog';
import { CreateRevisionSchema } from '$lib/server/blog/schemas';
import { apiCreated, apiError, apiValidationError } from '$lib/server/api/response';
import type { RequestHandler } from './$types';

/** Save a new revision. */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const { user } = requireApiAuthor(locals);

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
