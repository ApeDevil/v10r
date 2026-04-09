import * as v from 'valibot';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiCreated, apiError, apiOk, apiValidationError } from '$lib/server/api/response';
import { requireApiAuthor } from '$lib/server/auth/guards';
import { createPost, isSlugTaken, listPosts } from '$lib/server/blog';
import { CreatePostSchema } from '$lib/server/blog/schemas';
import {
	BLOG_WRITE_RATE_LIMIT_MAX,
	BLOG_WRITE_RATE_LIMIT_PREFIX,
	BLOG_WRITE_RATE_LIMIT_WINDOW,
} from '$lib/server/config';
import type { RequestHandler } from './$types';

const ratelimit = createLimiter(BLOG_WRITE_RATE_LIMIT_PREFIX, BLOG_WRITE_RATE_LIMIT_MAX, BLOG_WRITE_RATE_LIMIT_WINDOW);

/** List posts for current author (all statuses). */
export const GET: RequestHandler = async ({ url, locals }) => {
	const { user } = requireApiAuthor(locals);

	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const status = url.searchParams.get('status') as 'draft' | 'published' | 'archived' | undefined;
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
	const { user } = requireApiAuthor(locals);

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
