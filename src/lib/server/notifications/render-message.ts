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

import * as m from '$lib/paraglide/messages';
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

export interface DigestItem {
	messageKey: string;
	messageParams: NotificationParams;
}

/**
 * Per-channel body budget, in characters.
 *
 * Telegram hard-caps a sendMessage at 4096 and Discord an embed description at
 * 4096 (2000 for plain content) — exceeding either is a rejected send, not a
 * truncated one. Email has no such limit. `maxChars` is deliberately a caller
 * argument: the renderer must not know which channel it is feeding.
 */
export const DIGEST_BODY_LIMITS = { email: 100_000, telegram: 3500, discord: 1800 } as const;

/**
 * Render N notifications as one message.
 *
 * Returns a newline-separated body — `DeliveryPayload` is a single string and
 * every provider already formats one, so the digest stays inside the existing
 * contract instead of growing a parallel multi-item path. Overflow is REPORTED
 * in the body ("+N more"), never silently dropped.
 */
export function renderDigest(
	items: DigestItem[],
	locale: string,
	maxChars: number = DIGEST_BODY_LIMITS.email,
): { subject: string; body: string } {
	// Routed through renderNotification so the locale stays a plain string —
	// the generated message functions take a narrowed locale union.
	const subject = renderNotification('notif_digest_subject', { count: items.length }, locale);
	const intro = renderNotification('notif_digest_intro', {}, locale);

	const lines: string[] = [];
	let used = intro.length;
	let shown = 0;

	for (const item of items) {
		const line = `• ${renderNotification(item.messageKey, item.messageParams, locale)}`;
		// Reserve room for the overflow line so the cap can never be blown by it.
		if (used + line.length + 32 > maxChars) break;
		lines.push(line);
		used += line.length + 1;
		shown++;
	}

	const omitted = items.length - shown;
	const body = [intro, '', ...lines, ...(omitted > 0 ? [`… +${omitted} more`] : [])].join('\n');

	return { subject, body };
}
