import * as v from 'valibot';
import { CommentNotFoundError, hideComment, moderateCommentSchema } from '$lib/server/blog/comments';
import { guardApiAdmin } from '$lib/server/http/guards';
import { apiError, apiOk, apiValidationError } from '$lib/server/http/response';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, params, locals }) => {
	const guard = guardApiAdmin(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const body = await request.json().catch(() => ({}));
	const parsed = v.safeParse(moderateCommentSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	try {
		await hideComment({
			commentId: params.id,
			actor: { id: user.id, email: user.email },
			reason: parsed.output.reason,
			ipAddress: locals.clientIp,
		});
		return apiOk({ id: params.id, status: 'hidden' });
	} catch (err) {
		if (err instanceof CommentNotFoundError) return apiError(404, err.code, err.message);
		throw err;
	}
};
