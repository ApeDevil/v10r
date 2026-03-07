import { json } from '@sveltejs/kit';
import { requireApiUser } from '$lib/server/auth/guards';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { NOTIFICATION_RATE_LIMIT_MAX, NOTIFICATION_RATE_LIMIT_WINDOW } from '$lib/server/config';
import { markAsRead } from '$lib/server/db/notifications/mutations';
import { classifyDbError, safeDbMessage } from '$lib/server/db/errors';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:notifications:read', NOTIFICATION_RATE_LIMIT_MAX, NOTIFICATION_RATE_LIMIT_WINDOW);

export const POST: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiUser(locals);

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	try {
		const found = await markAsRead(params.id, user.id);
		if (!found) {
			return json({ error: 'Notification not found' }, { status: 404 });
		}
		return json({ success: true });
	} catch (err) {
		const dbErr = classifyDbError(err);
		return json({ error: safeDbMessage(dbErr.kind) }, { status: dbErr.toStatus() });
	}
};
