/**
 * NOTIFICATION SETTINGS — Per-user notification preferences.
 * Controls which notification types are delivered via which channels.
 */
import { boolean, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
import { notificationsSchema } from './notifications';

export const digestFrequencyEnum = notificationsSchema.enum('digest_frequency', [
	'instant',
	'daily',
	'weekly',
	'never',
]);

export const notificationSettings = notificationsSchema.table('notification_settings', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),

	// Email toggles per notification type
	emailMention: boolean('email_mention').notNull().default(true),
	emailComment: boolean('email_comment').notNull().default(true),
	emailSystem: boolean('email_system').notNull().default(false),
	emailSuccess: boolean('email_success').notNull().default(false),
	emailSecurity: boolean('email_security').notNull().default(true),
	emailFollow: boolean('email_follow').notNull().default(true),

	// Telegram toggles per notification type
	telegramMention: boolean('telegram_mention').notNull().default(false),
	telegramComment: boolean('telegram_comment').notNull().default(false),
	telegramSystem: boolean('telegram_system').notNull().default(false),
	telegramSecurity: boolean('telegram_security').notNull().default(true),

	// Discord toggles per notification type
	discordMention: boolean('discord_mention').notNull().default(false),
	discordComment: boolean('discord_comment').notNull().default(false),
	discordSystem: boolean('discord_system').notNull().default(false),
	discordSecurity: boolean('discord_security').notNull().default(true),

	// Digest
	digestFrequency: digestFrequencyEnum('digest_frequency').notNull().default('instant'),

	// Quiet hours (HH:MM format, null = disabled)
	quietStart: text('quiet_start'),
	quietEnd: text('quiet_end'),

	// Global mute
	mutedUntil: timestamp('muted_until', { withTimezone: true }),

	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
