import * as v from 'valibot';
import {
	CommentEditWindowExpiredError,
	CommentHiddenError,
	CommentNotFoundError,
	CommentNotOwnedError,
	editCommentSchema,
	editOwnComment,
	softDeleteOwnComment,
} from '$lib/server/blog/comments';
import { guardApiUser } from '$lib/server/http/guards';
import { apiError, apiNoContent, apiOk, apiValidationError } from '$lib/server/http/response';
import type { RequestHandler } from './$types';

/** Edit own comment. 5-minute window from creation. */
export const PATCH: RequestHandler = async ({ request, params, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Request body must be valid JSON.');

	const parsed = v.safeParse(editCommentSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	try {
		await editOwnComment({ commentId: params.id, authorId: user.id, body: parsed.output.body });
		return apiOk({ id: params.id });
	} catch (err) {
		if (err instanceof CommentNotFoundError) return apiError(404, err.code, err.message);
		if (err instanceof CommentNotOwnedError) return apiError(403, err.code, err.message);
		if (err instanceof CommentEditWindowExpiredError) return apiError(409, err.code, err.message);
		if (err instanceof CommentHiddenError) return apiError(409, err.code, err.message);
		throw err;
	}
};

/** Soft-delete own comment. */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	try {
		await softDeleteOwnComment({ commentId: params.id, authorId: user.id });
		return apiNoContent();
	} catch (err) {
		if (err instanceof CommentNotFoundError) return apiError(404, err.code, err.message);
		if (err instanceof CommentNotOwnedError) return apiError(403, err.code, err.message);
		throw err;
	}
};
