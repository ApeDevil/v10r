import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError, apiNoContent, apiOk } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import { CONV_RATE_LIMIT_MAX, CONV_RATE_LIMIT_PREFIX, CONV_RATE_LIMIT_WINDOW } from '$lib/server/config';
import { deleteConversation } from '$lib/server/db/ai/mutations';
import { getConversation } from '$lib/server/db/ai/queries';
import { classifyDbError, safeDbMessage } from '$lib/server/db/errors';
import type { RequestHandler } from './$types';

const ratelimit = createLimiter(CONV_RATE_LIMIT_PREFIX, CONV_RATE_LIMIT_MAX, CONV_RATE_LIMIT_WINDOW);

export const GET: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiUser(locals);

	const { success, reset } = await ratelimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	try {
		const conv = await getConversation(params.id, user.id);
		if (!conv) return apiError(404, 'not_found', 'Conversation not found.');
		return apiOk(conv);
	} catch (err) {
		const dbErr = classifyDbError(err);
		return apiError(dbErr.toStatus(), dbErr.kind, safeDbMessage(dbErr.kind));
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiUser(locals);

	const { success, reset } = await ratelimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	try {
		const deleted = await deleteConversation(params.id, user.id);
		if (!deleted) return apiError(404, 'not_found', 'Conversation not found.');
		return apiNoContent();
	} catch (err) {
		const dbErr = classifyDbError(err);
		return apiError(dbErr.toStatus(), dbErr.kind, safeDbMessage(dbErr.kind));
	}
};
