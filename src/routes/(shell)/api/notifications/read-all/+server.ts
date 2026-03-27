import { json } from '@sveltejs/kit';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { requireApiUser } from '$lib/server/auth/guards';
import { API_WRITE_RATE_LIMIT_MAX, API_WRITE_RATE_LIMIT_WINDOW } from '$lib/server/config';
import { classifyDbError, safeDbMessage } from '$lib/server/db/errors';
import { markAllAsRead } from '$lib/server/db/notifications/mutations';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:notifications:read-all', API_WRITE_RATE_LIMIT_MAX, API_WRITE_RATE_LIMIT_WINDOW);

export const POST: RequestHandler = async ({ locals }) => {
	const { user } = requireApiUser(locals);

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	try {
		const count = await markAllAsRead(user.id);
		return json({ success: true, count });
	} catch (err) {
		const dbErr = classifyDbError(err);
		return json({ error: safeDbMessage(dbErr.kind) }, { status: dbErr.toStatus() });
	}
};
