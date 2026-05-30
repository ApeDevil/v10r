import * as v from 'valibot';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiCreated, apiError, apiOk, apiValidationError } from '$lib/server/api/response';
import { guardApiUser } from '$lib/server/auth/guards';
import {
	CommentOnUnpublishedError,
	createComment,
	createCommentSchema,
	listComments,
	listCommentsQuerySchema,
} from '$lib/server/blog/comments';
import type { RequestHandler } from './$types';

const userRateLimit = createLimiter('ratelimit:comment:user', 5, '1 m');
const userHourLimit = createLimiter('ratelimit:comment:user:hour', 30, '1 h');
const ipRateLimit = createLimiter('ratelimit:comment:ip', 20, '1 h');
const postRateLimit = createLimiter('ratelimit:comment:post', 60, '1 m');

/** Public read of visible comments. Signed-in viewer also sees their own moderated comments. */
export const GET: RequestHandler = async ({ url, params, locals }) => {
	const parsed = v.safeParse(listCommentsQuerySchema, {
		locale: url.searchParams.get('locale'),
		cursor: url.searchParams.get('cursor') ?? undefined,
		limit: url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : undefined,
	});
	if (!parsed.success) return apiValidationError(parsed.issues);

	const result = await listComments({
		postId: params.id,
		locale: parsed.output.locale,
		cursor: parsed.output.cursor,
		limit: parsed.output.limit,
		viewerId: locals.user?.id,
	});

	return apiOk(result);
};

/** Create a comment. Signed-in only. Idempotent via clientNonce. */
export const POST: RequestHandler = async ({ request, params, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	// Rate limits — early reject before parsing / DB work.
	const [perUser, perHour, perIp, perPost] = await Promise.all([
		userRateLimit.limit(user.id),
		userHourLimit.limit(user.id),
		locals.clientIp ? ipRateLimit.limit(locals.clientIp) : Promise.resolve({ success: true, reset: 0 }),
		postRateLimit.limit(params.id),
	]);
	if (!perUser.success) return rateLimitResponse(perUser.reset);
	if (!perHour.success) return rateLimitResponse(perHour.reset);
	if ('success' in perIp && !perIp.success) return rateLimitResponse(perIp.reset);
	if (!perPost.success) return rateLimitResponse(perPost.reset);

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Request body must be valid JSON.');

	const parsed = v.safeParse(createCommentSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	try {
		const result = await createComment({
			postId: params.id,
			authorId: user.id,
			locale: parsed.output.locale,
			body: parsed.output.body,
			clientNonce: parsed.output.clientNonce,
		});

		if (result.idempotentReplay) {
			return apiOk({ commentId: result.id, idempotentReplay: true });
		}
		return apiCreated({ commentId: result.id });
	} catch (err) {
		if (err instanceof CommentOnUnpublishedError) {
			return apiError(403, err.code, err.message);
		}
		throw err;
	}
};
