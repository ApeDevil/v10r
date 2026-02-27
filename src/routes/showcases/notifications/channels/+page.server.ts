import { db } from '$lib/server/db';
import { userTelegramAccounts } from '$lib/server/db/schema/notifications/telegram';
import { userDiscordAccounts } from '$lib/server/db/schema/notifications/discord';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import {
	SSE_HEARTBEAT_MS,
	SSE_MAX_PER_USER,
	DEFAULT_DELIVERY_INTERVAL_MS,
	DELIVERY_MAX_ATTEMPTS,
} from '$lib/server/config';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const providers = {
		email: { configured: !!env.RESEND_API_KEY, name: 'Resend' },
		telegram: { configured: !!env.TELEGRAM_BOT_TOKEN, name: 'Telegram Bot API' },
		discord: { configured: !!env.DISCORD_BOT_TOKEN, name: 'Discord Bot' },
	};

	let userChannels = null;

	if (locals.user) {
		const [tg] = await db
			.select({
				isActive: userTelegramAccounts.isActive,
				telegramUsername: userTelegramAccounts.telegramUsername,
			})
			.from(userTelegramAccounts)
			.where(eq(userTelegramAccounts.userId, locals.user.id))
			.limit(1);

		const [dc] = await db
			.select({
				isActive: userDiscordAccounts.isActive,
				discordUsername: userDiscordAccounts.discordUsername,
			})
			.from(userDiscordAccounts)
			.where(eq(userDiscordAccounts.userId, locals.user.id))
			.limit(1);

		userChannels = {
			email: locals.user.email,
			telegram: tg ? { active: tg.isActive, username: tg.telegramUsername } : null,
			discord: dc ? { active: dc.isActive, username: dc.discordUsername } : null,
		};
	}

	return {
		providers,
		userChannels,
		config: {
			sseHeartbeatMs: SSE_HEARTBEAT_MS,
			sseMaxPerUser: SSE_MAX_PER_USER,
			deliveryIntervalMs: DEFAULT_DELIVERY_INTERVAL_MS,
			deliveryMaxAttempts: DELIVERY_MAX_ATTEMPTS,
		},
	};
};
