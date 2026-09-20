/**
 * DISCORD ACCOUNTS — Links v10r users to Discord accounts for DM notifications.
 * Only the identity is kept: DMs are sent with the bot token, so no user OAuth token is stored.
 */

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
		isActive: boolean('is_active').notNull().default(true),
		linkedAt: timestamp('linked_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index('discord_user_idx').on(table.userId)],
);
