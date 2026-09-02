/**
 * Notification digest — batched delivery for users who opted out of instant sends.
 *
 * WHY THIS IS NOT THE OUTBOX WORKER: the outbox drains rows that already exist.
 * A digest has none to drain — instant enqueue is SUPPRESSED for digest users
 * (see `routeExternal`), so this job is what turns a window of notifications
 * into deliveries in the first place. It writes into the same outbox afterwards,
 * so retry, backoff and dead-lettering all still apply unchanged.
 *
 * SCHEDULING REALITY: Vercel Hobby rejects sub-daily crons, so `weekly` cannot
 * have its own schedule — it is a code-level gate inside the same daily run
 * (a 7-day window instead of 1). And with ±59min jitter on both this job and the
 * delivery drain, a digest lands 0–24h after generation. Tighter guarantees are
 * not achievable on daily crons.
 */

import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	claimDigestRecipients,
	createDigestCarrier,
	getOrCreateSettings,
} from '$lib/server/db/notifications/mutations';
import { getNotificationsSince } from '$lib/server/db/notifications/queries';
import { userPreferences } from '$lib/server/db/schema/personalization/user-preferences';
import { createDigestDelivery } from './outbox';
import { DIGEST_BODY_LIMITS, renderDigest } from './render-message';
import { channelsForSettings } from './router';

/** Digest covers every outbox channel; push is instant and has no outbox row. */
export type DigestChannel = 'email' | 'telegram' | 'discord';

/** Cap on notifications pulled per user per digest — the renderer trims further. */
const MAX_ITEMS_PER_DIGEST = 200;

const WINDOW_MS = { daily: 24 * 60 * 60 * 1000, weekly: 7 * 24 * 60 * 60 * 1000 } as const;

export interface DigestRunResult {
	claimed: number;
	sent: number;
	empty: number;
	failed: number;
}

/**
 * Build and enqueue digests for one frequency.
 *
 * Users are CLAIMED atomically first — `last_digest_at` is stamped in the same
 * statement that selects them — so a second cron fire inside the same window
 * matches zero rows and sends nothing.
 */
export async function runDigest(frequency: 'daily' | 'weekly', now: Date = new Date()): Promise<DigestRunResult> {
	const cutoff = new Date(now.getTime() - WINDOW_MS[frequency]);
	const claimed = await claimDigestRecipients(frequency, cutoff);

	let sent = 0;
	let empty = 0;
	let failed = 0;

	for (const { userId, previousDigestAt } of claimed) {
		try {
			// Never sent before → look back exactly one window, not all time.
			const since = previousDigestAt ?? cutoff;
			const items = await getNotificationsSince(userId, since, MAX_ITEMS_PER_DIGEST);
			if (items.length === 0) {
				empty++;
				continue;
			}

			const settings = await getOrCreateSettings(userId);
			if (!settings) {
				empty++;
				continue;
			}

			// Reuse the ordinary routing rules, so per-type toggles, the global mute
			// and `digestFrequency: 'never'` all still apply. The digest routes as
			// `system` — it is a summary, not any one of the events inside it.
			const channels = channelsForSettings(settings, 'system').filter((c): c is DigestChannel => c !== 'push');
			if (channels.length === 0) {
				empty++;
				continue;
			}

			const [prefs] = await db
				.select({ locale: userPreferences.locale })
				.from(userPreferences)
				.where(eq(userPreferences.userId, userId))
				.limit(1);
			const locale = prefs?.locale ?? 'en';

			const carrier = await createDigestCarrier(userId, items.length);
			if (!carrier) {
				failed++;
				continue;
			}

			// One rendered body per channel: the budgets differ by an order of
			// magnitude, so a Telegram-sized digest would needlessly truncate email.
			for (const channel of channels) {
				const { body } = renderDigest(items, locale, DIGEST_BODY_LIMITS[channel]);
				await createDigestDelivery(carrier.id, channel, body);
			}
			sent++;
		} catch (err) {
			// One user's failure must not abort the run. They were already claimed,
			// so they wait for the next window rather than blocking everyone else.
			failed++;
			console.error(`[notification-digest] user ${userId} failed:`, err);
		}
	}

	return { claimed: claimed.length, sent, empty, failed };
}
