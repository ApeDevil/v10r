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

/** The settings fields this module reads. Widened so callers can pass a row. */
type RoutableSettings = Record<string, unknown> & {
	mutedUntil?: Date | null;
	digestFrequency?: string | null;
};

/**
 * Pure channel selection. Split out from `routeToChannels` so a caller that has
 * already loaded the settings row does not pay for a second read.
 *
 * SECURITY ALERTS ALWAYS DELIVER. `type === 'security'` bypasses the per-type
 * email toggle, the global mute, and the digest suppression alike. Previously
 * `mutedUntil` was checked BEFORE the security force-send, so a global mute
 * silently suppressed security alerts while an explicit `emailSecurity: false`
 * did not — the two mutes disagreed about the one category that matters most.
 * Resolved here in favour of always-deliver.
 */
export function channelsForSettings(settings: RoutableSettings, type: NotificationType): string[] {
	const channels: string[] = [];
	const isSecurity = type === 'security';

	if (!isSecurity) {
		// Global mute — a time-boxed "all quiet" switch.
		if (settings.mutedUntil && settings.mutedUntil > new Date()) return [];
		// `digestFrequency: 'never'` is a permanent opt-out of external delivery.
		// It was settable in the UI and read by nothing.
		if (settings.digestFrequency === 'never') return [];
	}

	// Email routing — security is always forced
	const emailKey = emailSettingsMap[type];
	if (isSecurity || settings[emailKey] === true) {
		channels.push('email');
	}

	// Telegram routing (Phase 3 will extend settings with telegram columns)
	const telegramKey = `telegram${type.charAt(0).toUpperCase() + type.slice(1)}`;
	if (telegramKey in settings && settings[telegramKey] === true) {
		channels.push('telegram');
	}

	// Discord routing (Phase 4 will extend settings with discord columns)
	const discordKey = `discord${type.charAt(0).toUpperCase() + type.slice(1)}`;
	if (discordKey in settings && settings[discordKey] === true) {
		channels.push('discord');
	}

	// Web push routing — same convention; types without a push column
	// (success/follow) simply never route here
	const pushKey = `push${type.charAt(0).toUpperCase() + type.slice(1)}`;
	if (pushKey in settings && settings[pushKey] === true) {
		channels.push('push');
	}

	return channels;
}

export async function routeToChannels(userId: string, type: NotificationType): Promise<string[]> {
	const settings = await getOrCreateSettings(userId);
	if (!settings) return [];
	return channelsForSettings(settings, type);
}
