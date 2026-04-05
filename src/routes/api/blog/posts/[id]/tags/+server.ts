import * as v from 'valibot';
import { requireApiAuthor, requirePostOwnership } from '$lib/server/auth/guards';
import { getPostById, setPostTags } from '$lib/server/blog';
import { SetTagsSchema } from '$lib/server/blog/schemas';
import { apiNoContent, apiError, apiValidationError } from '$lib/server/api/response';
import type { RequestHandler } from './$types';

/** Set tags for a post. */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const { user } = requireApiAuthor(locals);

	const post = await getPostById(params.id);
	requirePostOwnership(post, user);

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Request body must be valid JSON.');

	const parsed = v.safeParse(SetTagsSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	await setPostTags(params.id, parsed.output.tagIds);
	return apiNoContent();
};
