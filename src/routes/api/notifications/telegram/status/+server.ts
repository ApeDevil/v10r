import { json } from '@sveltejs/kit';
import { requireApiUser } from '$lib/server/auth/guards';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { API_READ_RATE_LIMIT_MAX, API_READ_RATE_LIMIT_WINDOW } from '$lib/server/config';
import { db } from '$lib/server/db';
import { userTelegramAccounts } from '$lib/server/db/schema/notifications/telegram';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:notifications:telegram:status', API_READ_RATE_LIMIT_MAX, API_READ_RATE_LIMIT_WINDOW);

export const GET: RequestHandler = async ({ locals }) => {
	const { user } = requireApiUser(locals);

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const [account] = await db
		.select({
			telegramUsername: userTelegramAccounts.telegramUsername,
			isActive: userTelegramAccounts.isActive,
			linkedAt: userTelegramAccounts.linkedAt,
		})
		.from(userTelegramAccounts)
		.where(eq(userTelegramAccounts.userId, user.id))
		.limit(1);

	if (!account) {
		return json({ connected: false });
	}

	return json({
		connected: true,
		username: account.telegramUsername,
		isActive: account.isActive,
		linkedAt: account.linkedAt.toISOString(),
	});
};
