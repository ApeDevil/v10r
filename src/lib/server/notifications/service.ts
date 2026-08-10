/**
 * Notification service — the main entry point for sending notifications.
 * Creates the in-app notification, pushes SSE, and routes to external channels.
 */

import { waitUntil } from '@vercel/functions';
import { eq } from 'drizzle-orm';
import { BRAND_NAME } from '$lib/branding';
import { db } from '$lib/server/db';
import { createNotification, getOrCreateSettings } from '$lib/server/db/notifications/mutations';
import { userPreferences } from '$lib/server/db/schema/app/user-preferences';
import { user } from '$lib/server/db/schema/auth/_better-auth';
import type { NotificationParams } from '$lib/server/db/schema/notifications/notifications';
import { createDeliveries } from './outbox';
import { getProvider } from './providers';
import { isQuietNow } from './quiet-hours';
import { renderNotification } from './render-message';
import { channelsForSettings } from './router';
import { notifyUser } from './stream';

type NotificationType = 'mention' | 'comment' | 'system' | 'success' | 'security' | 'follow';

interface SendInput {
	userId: string;
	actorId?: string;
	type: NotificationType;
	/** Paraglide message key — rendered at viewer/delivery time using the recipient's locale. */
	messageKey: string;
	messageParams?: NotificationParams;
	entityRef?: string;
	groupKey?: string;
	actionUrl?: string;
}

async function routeExternal(notificationId: string, userId: string, type: NotificationType) {
	const settings = await getOrCreateSettings(userId);
	if (!settings) return;

	const channels = channelsForSettings(settings, type);
	if (channels.length === 0) return;

	// Recipient preferences, read ONCE here rather than inside sendPushNow —
	// quiet hours needs the timezone and push needs the locale, and they came
	// from the same row all along. Quiet hours therefore costs no extra query.
	const [prefs] = await db
		.select({ locale: userPreferences.locale, timeZone: userPreferences.timezone })
		.from(userPreferences)
		.where(eq(userPreferences.userId, userId))
		.limit(1);
	const locale = prefs?.locale ?? 'en';

	// Quiet hours — decided HERE, at enqueue time, so it covers push (which
	// never touches the outbox) with the same check and does not touch the
	// claim SQL the delivery worker depends on.
	//
	// The behaviour is DROP, not defer: the in-app notification and its live SSE
	// frame have already been delivered by send(), so the user still sees it the
	// moment they look. Only the interrupting channels are suppressed. Security
	// alerts are exempt (see channelsForSettings).
	if (type !== 'security' && isQuietNow(settings.quietStart, settings.quietEnd, prefs?.timeZone)) {
		return;
	}

	// Web push bypasses the outbox: the delivery drain is cron-dependent on
	// serverless, while a push send is one fast HTTPS POST per device — deliver
	// it now, synchronously with routing. Partition it out BEFORE the outbox
	// cast below, or the cast would silently funnel push into pending rows.
	if (channels.includes('push')) {
		// Awaited so the whole send lives inside the waitUntil() envelope in
		// send() below — a dangling promise here would escape it and get frozen
		// with the function instance. Caught so a push failure can't block the
		// outbox insert.
		await sendPushNow(notificationId, userId, type, locale).catch((err) =>
			console.error('[notifications] push send failed:', err),
		);
	}

	const outboxChannels = channels.filter((channel): channel is 'email' | 'telegram' | 'discord' => channel !== 'push');
	if (outboxChannels.length === 0) return;

	// Digest users get no instant outbox row — the digest job builds their
	// deliveries from the notification window instead. Push above is unaffected:
	// it has no outbox row to batch, and a batched push is a contradiction.
	// Security is exempt: an alert must not wait for tomorrow's digest.
	if (type !== 'security' && (settings.digestFrequency === 'daily' || settings.digestFrequency === 'weekly')) {
		return;
	}

	const [u] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId)).limit(1);

	if (!u) return;

	await createDeliveries(notificationId, outboxChannels);
}

/**
 * Synchronous web-push delivery. Payload rule (lock screens): no PII, no
 * content — a generic localized category line; the tap opens the inbox where
 * the real content loads behind session auth.
 */
async function sendPushNow(notificationId: string, userId: string, type: NotificationType, locale: string) {
	const provider = getProvider('push');
	if (!provider) return;

	const result = await provider.send({
		to: userId, // the push provider fans out over the user's devices itself
		subject: BRAND_NAME,
		body: renderNotification(`notif_push_${type}`, {}, locale),
		navigate: `/account/notifications?n=${notificationId}`,
		lang: locale,
	});

	// Push writes no delivery rows (outbox bypass), so this log line is the
	// only per-send record — Vercel function logs are the monitoring surface.
	// NO_SUBSCRIPTIONS is the normal no-devices case, not a failure.
	if (result.success) {
		console.log(`[notifications] push ${type}: ${result.providerMessageId ?? 'sent'}`);
	} else if (result.errorCode !== 'NO_SUBSCRIPTIONS') {
		console.error(
			`[notifications] push ${type} failed: ${result.errorCode ?? 'UNKNOWN'}${result.errorMessage ? ` — ${result.errorMessage}` : ''}`,
		);
	}
}

export const NotificationService = {
	async send(input: SendInput) {
		const notification = await createNotification(input);

		// Vercel freezes the execution environment once the response returns —
		// a bare un-awaited promise here is NOT guaranteed to finish (documented
		// behavior, not a race we control). waitUntil() keeps the outbox insert
		// and the synchronous push fan-out alive past the response; off-Vercel
		// (container, tests) it degrades to plain fire-and-forget.
		//
		// `notifyUser` is in here for the same reason: on serverless it is a Redis
		// PUBLISH over the network, so a bare un-awaited call could be frozen
		// before the request lands.
		waitUntil(
			notifyUser(input.userId, {
				type: 'new',
				notification: {
					id: notification.id,
					type: notification.type,
					messageKey: notification.messageKey,
					messageParams: notification.messageParams,
					actionUrl: notification.actionUrl,
					createdAt: notification.createdAt.toISOString(),
				},
			}).catch((err) => console.error('[notifications] live notify failed:', err)),
		);

		waitUntil(
			routeExternal(notification.id, input.userId, input.type).catch((err) =>
				console.error('[notifications] routing failed:', err),
			),
		);

		return notification;
	},
};
