/**
 * Notification delivery worker — processes pending outbox deliveries.
 * Fetches batches of pending deliveries, sends through providers, updates status.
 * Resolves the correct recipient address per channel (email, telegram chat ID, discord user ID).
 */

import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { userPreferences } from '$lib/server/db/schema/app/user-preferences';
import { user } from '$lib/server/db/schema/auth/_better-auth';
import { notifications } from '$lib/server/db/schema/notifications/notifications';
import { userTelegramAccounts } from '$lib/server/db/schema/notifications/telegram';
import { getPendingDeliveries, markFailed, markProcessing, markSent } from '$lib/server/notifications/outbox';
import { getProvider } from '$lib/server/notifications/providers';
import type { DeliveryPayload } from '$lib/server/notifications/providers/types';
import { renderNotification } from '$lib/server/notifications/render-message';

/** Resolve the recipient address for a given channel + user */
async function resolveRecipient(userId: string, channel: string): Promise<string | null> {
	if (channel === 'email') {
		const [u] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId)).limit(1);
		return u?.email ?? null;
	}

	if (channel === 'telegram') {
		const [account] = await db
			.select({ chatId: userTelegramAccounts.telegramChatId })
			.from(userTelegramAccounts)
			.where(and(eq(userTelegramAccounts.userId, userId), eq(userTelegramAccounts.isActive, true)))
			.limit(1);
		return account?.chatId ?? null;
	}

	if (channel === 'discord') {
		// Discord resolution will be added in Phase 4
		// Uses userDiscordAccounts table
		try {
			const { userDiscordAccounts } = await import('$lib/server/db/schema/notifications/discord');
			const [account] = await db
				.select({ discordUserId: userDiscordAccounts.discordUserId })
				.from(userDiscordAccounts)
				.where(and(eq(userDiscordAccounts.userId, userId), eq(userDiscordAccounts.isActive, true)))
				.limit(1);
			return account?.discordUserId ?? null;
		} catch {
			return null;
		}
	}

	return null;
}

let processing = false;

export async function notificationDelivery(): Promise<number> {
	if (processing) return 0;
	processing = true;
	try {
		return await processDeliveryBatch();
	} finally {
		processing = false;
	}
}

async function processDeliveryBatch(): Promise<number> {
	const deliveries = await getPendingDeliveries(50);
	if (deliveries.length === 0) return 0;

	let processed = 0;

	for (const delivery of deliveries) {
		const provider = getProvider(delivery.channel);
		if (!provider) {
			await markFailed(delivery.id, 'NO_PROVIDER', `No provider for channel: ${delivery.channel}`, false);
			processed++;
			continue;
		}

		await markProcessing(delivery.id);

		// Fetch the notification
		const [notif] = await db.select().from(notifications).where(eq(notifications.id, delivery.notificationId)).limit(1);

		if (!notif) {
			await markFailed(delivery.id, 'NO_NOTIFICATION', 'Notification not found', false);
			processed++;
			continue;
		}

		// Resolve recipient for the channel
		const recipient = await resolveRecipient(notif.userId, delivery.channel);
		if (!recipient) {
			await markFailed(delivery.id, 'NO_RECIPIENT', `No ${delivery.channel} recipient for user`, false);
			processed++;
			continue;
		}

		// Resolve recipient locale (default 'en' if no preferences row).
		const [prefs] = await db
			.select({ locale: userPreferences.locale })
			.from(userPreferences)
			.where(eq(userPreferences.userId, notif.userId))
			.limit(1);
		const recipientLocale = prefs?.locale ?? 'en';

		const rendered = renderNotification(notif.messageKey, notif.messageParams, recipientLocale);
		const payload: DeliveryPayload = {
			to: recipient,
			subject: rendered,
			body: rendered,
		};

		const result = await provider.send(payload);

		if (result.success) {
			await markSent(delivery.id, result.providerMessageId);
		} else {
			await markFailed(
				delivery.id,
				result.errorCode ?? 'UNKNOWN',
				result.errorMessage ?? 'Unknown error',
				result.retryable ?? false,
			);

			// If Telegram 403 (bot blocked), mark account inactive
			if (delivery.channel === 'telegram' && result.errorCode === '403') {
				await db
					.update(userTelegramAccounts)
					.set({ isActive: false })
					.where(and(eq(userTelegramAccounts.userId, notif.userId), eq(userTelegramAccounts.isActive, true)));
			}

			// If Discord 403 (cannot DM), mark account inactive
			if (delivery.channel === 'discord' && result.errorCode === '403') {
				try {
					const { userDiscordAccounts } = await import('$lib/server/db/schema/notifications/discord');
					await db
						.update(userDiscordAccounts)
						.set({ isActive: false })
						.where(and(eq(userDiscordAccounts.userId, notif.userId), eq(userDiscordAccounts.isActive, true)));
				} catch {
					// Discord schema not available
				}
			}
		}

		processed++;
	}

	return processed;
}
