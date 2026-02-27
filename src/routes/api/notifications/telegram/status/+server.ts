import { json } from '@sveltejs/kit';
import { requireApiUser } from '$lib/server/auth/guards';
import { db } from '$lib/server/db';
import { userTelegramAccounts } from '$lib/server/db/schema/notifications/telegram';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const { user } = requireApiUser(locals);

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
