import { classifyDbError, safeDbMessage } from '$lib/server/db/errors';
import { markAsRead } from '$lib/server/db/notifications/mutations';
import { guardApiUser } from '$lib/server/http/guards';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiError, apiNoContent } from '$lib/server/http/response';
import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW } from '$lib/server/notifications/config';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:notifications:read', RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);

export const POST: RequestHandler = async ({ params, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	try {
		const found = await markAsRead(params.id, user.id);
		if (!found) return apiError(404, 'not_found', 'Notification not found');
		return apiNoContent();
	} catch (err) {
		const dbErr = classifyDbError(err);
		return apiError(dbErr.toStatus(), dbErr.kind, safeDbMessage(dbErr.kind));
	}
};
