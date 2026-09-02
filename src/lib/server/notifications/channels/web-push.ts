import webpush from 'web-push';
import { env } from '$env/dynamic/private';
import { deletePushSubscriptionByEndpoint, touchPushSubscription } from '$lib/server/db/notifications/mutations';
import { getPushSubscriptions } from '$lib/server/db/notifications/queries';
import type { DeliveryChannel, DeliveryPayload, DeliveryResult } from './types';

/** Declarative Web Push format marker (WebKit explainer / W3C Push API draft). */
const DECLARATIVE_WEB_PUSH_VERSION = 8030;

/**
 * Web push channel. Unlike email/telegram/discord (one recipient string), a
 * user has N push subscriptions — `payload.to` is the v10r USER id and this
 * channel owns the per-device fan-out, including pruning endpoints the push
 * service reports dead (404/410 = device unsubscribed).
 *
 * The message body is the declarative-web-push JSON: Safari/iOS 18.4+ renders
 * it natively with no service-worker code; our SW `push` handler parses the
 * identical shape for Chrome/Android. One payload contract, two display paths.
 *
 * Payload rule (lock screens!): no PII, no content bodies — generic localized
 * category text; the real content loads behind session auth after the tap.
 */
export class WebPushChannel implements DeliveryChannel {
	async send(payload: DeliveryPayload): Promise<DeliveryResult> {
		const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = env;
		if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
			return {
				success: false,
				errorCode: 'NO_VAPID_KEYS',
				errorMessage: 'VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT not configured',
				retryable: false,
			};
		}

		const subscriptions = await getPushSubscriptions(payload.to);
		if (subscriptions.length === 0) {
			return {
				success: false,
				errorCode: 'NO_SUBSCRIPTIONS',
				errorMessage: 'User has no push subscriptions',
				retryable: false,
			};
		}

		const message = JSON.stringify({
			web_push: DECLARATIVE_WEB_PUSH_VERSION,
			notification: {
				title: payload.subject,
				body: payload.body,
				navigate: payload.navigate ?? '/account/notifications',
				lang: payload.lang ?? 'en',
			},
		});

		let sent = 0;
		let pruned = 0;
		let lastError: DeliveryResult | null = null;

		for (const subscription of subscriptions) {
			try {
				await webpush.sendNotification(
					{ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
					message,
					{
						vapidDetails: { subject: VAPID_SUBJECT, publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY },
						TTL: 24 * 60 * 60,
						urgency: 'normal',
					},
				);
				sent++;
				touchPushSubscription(subscription.endpoint).catch(() => {});
			} catch (err) {
				const statusCode = (err as { statusCode?: number }).statusCode ?? 0;
				// 404/410: the push service says this endpoint is gone — prune it.
				if (statusCode === 404 || statusCode === 410) {
					pruned++;
					deletePushSubscriptionByEndpoint(subscription.endpoint).catch(() => {});
					continue;
				}
				lastError = {
					success: false,
					errorCode: statusCode ? String(statusCode) : 'NETWORK',
					errorMessage: err instanceof Error ? err.message : 'Push send failed',
					retryable: statusCode === 429 || statusCode >= 500 || statusCode === 0,
				};
			}
		}

		if (sent > 0) {
			// Aggregate result — providerMessageId records the fan-out outcome.
			return { success: true, providerMessageId: `${sent}/${subscriptions.length} devices` };
		}
		if (pruned === subscriptions.length) {
			return {
				success: false,
				errorCode: 'ALL_PRUNED',
				errorMessage: 'All subscriptions were dead and have been pruned',
				retryable: false,
			};
		}
		return lastError ?? { success: false, errorCode: 'UNKNOWN', errorMessage: 'Push send failed', retryable: true };
	}
}
