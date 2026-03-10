/**
 * DISCORD ACCOUNTS — Links v10r users to Discord accounts for DM notifications.
 * Tokens are stored encrypted (AES-256-GCM).
 */

import { sql } from 'drizzle-orm';
import { boolean, index, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
import { notificationsSchema } from './notifications';

export const userDiscordAccounts = notificationsSchema.table(
	'user_discord_accounts',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.unique()
			.references(() => user.id, { onDelete: 'cascade' }),
		discordUserId: text('discord_user_id').notNull().unique(),
		discordUsername: text('discord_username'),
		accessToken: text('access_token').notNull(),
		refreshToken: text('refresh_token').notNull(),
		tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }).notNull(),
		isActive: boolean('is_active').notNull().default(true),
		tokenRefreshFailedAt: timestamp('token_refresh_failed_at', { withTimezone: true }),
		linkedAt: timestamp('linked_at', { withTimezone: true }).notNull().defaultNow(),
		tokensRefreshedAt: timestamp('tokens_refreshed_at', { withTimezone: true }),
		unlinkedAt: timestamp('unlinked_at', { withTimezone: true }),
	},
	(table) => [
		index('discord_user_idx').on(table.userId),
		index('discord_token_refresh_idx')
			.on(table.tokenExpiresAt)
			.where(sql`is_active = true AND token_refresh_failed_at IS NULL`),
	],
);
