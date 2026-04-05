import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiNoContent, apiError } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import { NOTIFICATION_RATE_LIMIT_MAX, NOTIFICATION_RATE_LIMIT_WINDOW } from '$lib/server/config';
import { classifyDbError, safeDbMessage } from '$lib/server/db/errors';
import { markAsRead } from '$lib/server/db/notifications/mutations';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:notifications:read', NOTIFICATION_RATE_LIMIT_MAX, NOTIFICATION_RATE_LIMIT_WINDOW);

export const POST: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiUser(locals);

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
