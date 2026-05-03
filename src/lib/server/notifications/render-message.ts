/**
 * Render a notification message in a specific locale.
 *
 * Used by both:
 *   - The delivery worker (locale = recipient's preferences.locale).
 *   - Read-side queries that need a pre-rendered string for the requesting user
 *     (locale = event.locals.locale).
 *
 * Paraglide v2 message functions accept an options bag with `locale` to
 * override the ambient resolution per call. Index access by string key is
 * narrowed with a runtime check + sensible fallback.
 */

import { m } from '$lib/i18n';
import type { NotificationParams } from '$lib/server/db/schema/notifications/notifications';

type AnyMessageFn = (params?: Record<string, unknown>, options?: { locale?: string }) => string;

export function renderNotification(messageKey: string, params: NotificationParams, locale: string): string {
	const registry = m as unknown as Record<string, AnyMessageFn | undefined>;
	const fn = registry[messageKey];
	if (typeof fn !== 'function') {
		// Unknown key — surface the key so the missing translation is visible.
		return messageKey;
	}
	return fn(params, { locale });
}
