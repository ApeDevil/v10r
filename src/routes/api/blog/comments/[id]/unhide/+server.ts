import { CommentNotFoundError, unhideComment } from '$lib/server/blog/comments';
import { guardApiAdmin } from '$lib/server/http/guards';
import { apiError, apiOk } from '$lib/server/http/response';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals }) => {
	const guard = guardApiAdmin(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	try {
		await unhideComment({
			commentId: params.id,
			actor: { id: user.id, email: user.email },
			ipAddress: locals.clientIp,
		});
		return apiOk({ id: params.id, status: 'visible' });
	} catch (err) {
		if (err instanceof CommentNotFoundError) return apiError(404, err.code, err.message);
		throw err;
	}
};
