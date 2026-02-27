/**
 * Notification router — determines which channels a notification should be delivered to
 * based on user settings and notification type.
 */
import { getOrCreateSettings } from '$lib/server/db/notifications/mutations';

type NotificationType = 'mention' | 'comment' | 'system' | 'success' | 'security' | 'follow';

const emailSettingsMap: Record<NotificationType, string> = {
	mention: 'emailMention',
	comment: 'emailComment',
	system: 'emailSystem',
	success: 'emailSuccess',
	security: 'emailSecurity',
	follow: 'emailFollow',
};

export async function routeToChannels(
	userId: string,
	type: NotificationType,
): Promise<string[]> {
	const settings = await getOrCreateSettings(userId);
	if (!settings) return [];

	// Check global mute
	if (settings.mutedUntil && settings.mutedUntil > new Date()) return [];

	const channels: string[] = [];

	// Email routing — security is always forced
	const emailKey = emailSettingsMap[type] as keyof typeof settings;
	if (type === 'security' || settings[emailKey] === true) {
		channels.push('email');
	}

	// Telegram routing (Phase 3 will extend settings with telegram columns)
	const telegramKey = `telegram${type.charAt(0).toUpperCase() + type.slice(1)}` as keyof typeof settings;
	if (telegramKey in settings && settings[telegramKey] === true) {
		channels.push('telegram');
	}

	// Discord routing (Phase 4 will extend settings with discord columns)
	const discordKey = `discord${type.charAt(0).toUpperCase() + type.slice(1)}` as keyof typeof settings;
	if (discordKey in settings && settings[discordKey] === true) {
		channels.push('discord');
	}

	return channels;
}
