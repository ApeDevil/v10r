/**
 * Proactive Discord token refresh — refreshes tokens expiring within 24 hours.
 */
import { db } from '$lib/server/db';
import { userDiscordAccounts } from '$lib/server/db/schema/notifications/discord';
import { and, eq, lt, sql } from 'drizzle-orm';
import { refreshDiscordTokens } from '$lib/server/notifications/providers/discord';

export async function discordTokenRefresh(): Promise<number> {
	const refreshBefore = new Date(Date.now() + 24 * 60 * 60 * 1000);

	const accounts = await db
		.select({ id: userDiscordAccounts.id })
		.from(userDiscordAccounts)
		.where(
			and(
				eq(userDiscordAccounts.isActive, true),
				lt(userDiscordAccounts.tokenExpiresAt, refreshBefore),
				sql`${userDiscordAccounts.tokenRefreshFailedAt} IS NULL`,
			),
		)
		.limit(50);

	let refreshed = 0;

	for (const account of accounts) {
		const success = await refreshDiscordTokens(account.id);
		if (success) refreshed++;
	}

	return refreshed;
}
