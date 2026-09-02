import * as v from 'valibot';
import { createPost, isSlugTaken, listPosts } from '$lib/server/blog';
import { WRITE_RATE_LIMIT_MAX, WRITE_RATE_LIMIT_PREFIX, WRITE_RATE_LIMIT_WINDOW } from '$lib/server/blog/config';
import { CreatePostSchema } from '$lib/server/blog/schemas';
import { guardApiBlogAuthor } from '$lib/server/http/guards';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiCreated, apiError, apiOk, apiValidationError } from '$lib/server/http/response';
import type { PostStatus } from '$lib/types/db-enums';
import type { RequestHandler } from './$types';

const ratelimit = createLimiter(WRITE_RATE_LIMIT_PREFIX, WRITE_RATE_LIMIT_MAX, WRITE_RATE_LIMIT_WINDOW);

/** List posts for current author (all statuses). */
export const GET: RequestHandler = async ({ url, locals }) => {
	const guard = guardApiBlogAuthor(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const status = url.searchParams.get('status') as PostStatus | undefined;
	const validStatuses = ['draft', 'published', 'archived'];

	const result = await listPosts({
		authorId: user.id,
		status: status && validStatuses.includes(status) ? status : undefined,
		page,
		pageSize: 50,
		sort: 'updated',
		dir: 'desc',
	});

	return apiOk(result);
};

/** Create a new draft post. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const guard = guardApiBlogAuthor(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await ratelimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Request body must be valid JSON.');

	const parsed = v.safeParse(CreatePostSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	const taken = await isSlugTaken(parsed.output.slug);
	if (taken) return apiError(409, 'slug_taken', 'Slug already taken');

	const post = await createPost(user.id, { slug: parsed.output.slug });
	return apiCreated({ post });
};
