/**
 * TELEGRAM ACCOUNTS — Links v10r users to Telegram chat IDs for DM notifications.
 */

import { sql } from 'drizzle-orm';
import { boolean, index, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
import { notificationsSchema } from './notifications';

export const userTelegramAccounts = notificationsSchema.table(
	'user_telegram_accounts',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.unique()
			.references(() => user.id, { onDelete: 'cascade' }),
		telegramChatId: text('telegram_chat_id').notNull().unique(),
		telegramUsername: text('telegram_username'),
		isActive: boolean('is_active').notNull().default(true),
		linkedAt: timestamp('linked_at', { withTimezone: true }).notNull().defaultNow(),
		unlinkedAt: timestamp('unlinked_at', { withTimezone: true }),
	},
	(table) => [index('telegram_user_idx').on(table.userId)],
);

export const telegramVerificationTokens = notificationsSchema.table(
	'telegram_verification_tokens',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		token: text('token').notNull().unique(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		usedAt: timestamp('used_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index('telegram_token_cleanup_idx').on(table.expiresAt).where(sql`used_at IS NULL`)],
);
