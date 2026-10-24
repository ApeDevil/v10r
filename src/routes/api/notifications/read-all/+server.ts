import { classifyDbError, safeDbMessage } from '#lib/server/db/errors.ts';
import { markAllAsRead } from '#lib/server/db/notifications/mutations.ts';
import { WRITE_RATE_LIMIT_MAX, WRITE_RATE_LIMIT_WINDOW } from '#lib/server/http/config.ts';
import { guardApiUser } from '#lib/server/http/guards.ts';
import { createLimiter, rateLimitResponse } from '#lib/server/http/rate-limit.ts';
import { apiError, apiOk } from '#lib/server/http/response.ts';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:notifications:read-all', WRITE_RATE_LIMIT_MAX, WRITE_RATE_LIMIT_WINDOW);

export const POST: RequestHandler = async ({ locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	try {
		const count = await markAllAsRead(user.id);
		return apiOk({ count });
	} catch (err) {
		const dbErr = classifyDbError(err);
		return apiError(dbErr.toStatus(), 'db_error', safeDbMessage(dbErr.kind));
	}
};
