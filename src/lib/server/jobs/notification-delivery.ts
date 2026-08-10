/**
 * Notification delivery worker — drains the outbox queue.
 *
 * Claims a batch atomically, sends each through its provider, and reports every
 * outcome back under the claim's fence token. Also reclaims leases abandoned by a
 * crashed worker. See docs/blueprint/architecture/workers.md.
 */

import { and, eq, inArray } from 'drizzle-orm';
import { DELIVERY_BATCH_SIZE } from '$lib/server/config';
import { db } from '$lib/server/db';
import { userPreferences } from '$lib/server/db/schema/app/user-preferences';
import { user } from '$lib/server/db/schema/auth/_better-auth';
import { userTelegramAccounts } from '$lib/server/db/schema/notifications/telegram';
import {
	type ClaimedDelivery,
	claimDeliveries,
	markFailed,
	markSent,
	reclaimStaleDeliveries,
} from '$lib/server/notifications/outbox';
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

/** One query for the whole batch instead of one per row. Missing rows default to 'en'. */
async function resolveLocales(userIds: string[]): Promise<Map<string, string>> {
	if (userIds.length === 0) return new Map();

	const rows = await db
		.select({ userId: userPreferences.userId, locale: userPreferences.locale })
		.from(userPreferences)
		.where(inArray(userPreferences.userId, userIds));

	return new Map(rows.map((r) => [r.userId, r.locale ?? 'en']));
}

/** Deactivate a channel account the provider told us we can no longer reach. */
async function deactivateAccount(channel: string, userId: string): Promise<void> {
	if (channel === 'telegram') {
		await db
			.update(userTelegramAccounts)
			.set({ isActive: false })
			.where(and(eq(userTelegramAccounts.userId, userId), eq(userTelegramAccounts.isActive, true)));
		return;
	}

	if (channel === 'discord') {
		try {
			const { userDiscordAccounts } = await import('$lib/server/db/schema/notifications/discord');
			await db
				.update(userDiscordAccounts)
				.set({ isActive: false })
				.where(and(eq(userDiscordAccounts.userId, userId), eq(userDiscordAccounts.isActive, true)));
		} catch {
			// Discord schema not available
		}
	}
}

let draining = false;

export async function notificationDelivery(): Promise<number> {
	// NOT a correctness lock — the atomic claim is. This only stops one process from
	// stacking overlapping drains when a batch outlives the 15s scheduler tick
	// (delivery-scheduler.ts and scheduler.ts both call this in the same process on
	// persistent platforms). Each stacked run would claim another batch and hold
	// another set of open provider sockets; dropping the tick is the right
	// backpressure. On Vercel each invocation is a fresh module instance, so this is
	// a no-op there — which is fine, because there the claim is all that matters.
	if (draining) return 0;
	draining = true;
	try {
		// Reap FIRST: reclaimed rows get a future next_attempt_at, so they are not
		// re-claimed in this same tick. Running inside the guard also means a process
		// can never reap the batch it is itself working on.
		const reclaimed = await reclaimStaleDeliveries();
		if (reclaimed > 0) {
			console.warn(`[notification-delivery] reclaimed ${reclaimed} stale claim(s)`);
		}
		return await processDeliveryBatch();
	} finally {
		draining = false;
	}
}

/** Send one claimed delivery and report its outcome. Throws only on a bug. */
async function deliverOne(claim: ClaimedDelivery, locale: string): Promise<void> {
	const provider = getProvider(claim.channel);
	if (!provider) {
		await markFailed(claim, 'NO_PROVIDER', `No provider for channel: ${claim.channel}`, false);
		return;
	}

	const recipient = await resolveRecipient(claim.userId, claim.channel);
	if (!recipient) {
		await markFailed(claim, 'NO_RECIPIENT', `No ${claim.channel} recipient for user`, false);
		return;
	}

	const rendered = renderNotification(claim.messageKey, claim.messageParams, locale);
	// A digest carries its body pre-rendered (N notifications, per-channel length
	// budget). The subject still renders from the message key either way.
	const payload: DeliveryPayload = { to: recipient, subject: rendered, body: claim.bodyOverride ?? rendered };

	const result = await provider.send(payload);

	if (result.success) {
		await markSent(claim, result.providerMessageId);
		return;
	}

	await markFailed(
		claim,
		result.errorCode ?? 'UNKNOWN',
		result.errorMessage ?? 'Unknown error',
		result.retryable ?? false,
	);

	// 403 means the user blocked the bot / closed DMs — the address is dead, not the send.
	if (result.errorCode === '403') {
		await deactivateAccount(claim.channel, claim.userId);
	}
}

async function processDeliveryBatch(): Promise<number> {
	const claims = await claimDeliveries(DELIVERY_BATCH_SIZE);
	if (claims.length === 0) return 0;

	const locales = await resolveLocales([...new Set(claims.map((c) => c.userId))]);

	let processed = 0;

	for (const claim of claims) {
		try {
			await deliverOne(claim, locales.get(claim.userId) ?? 'en');
		} catch (err) {
			// A throw here would otherwise abort the loop and strand every remaining
			// CLAIMED row in 'processing' until the reaper. renderNotification calls a
			// Paraglide fn with arbitrary params, and the email/push providers can throw.
			const message = err instanceof Error ? err.message : String(err);
			console.error(`[notification-delivery] ${claim.id} (${claim.channel}):`, message);
			await markFailed(claim, 'WORKER_ERROR', message, true);
		}
		processed++;
	}

	return processed;
}
