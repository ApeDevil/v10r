import { and, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import {
	ANALYTICS_RETENTION_DAYS,
	ANALYTICS_USER_RETENTION_DAYS,
	BOT_HIT_RETENTION_DAYS,
	CONSENT_RETENTION_DAYS,
} from '$lib/server/config';
import { db } from '$lib/server/db';
import { botHits, consentEvents, events, pairingCodes, sessions, userEvents } from '$lib/server/db/schema/analytics';

/**
 * Delete expired analytics rows. Per-table retention:
 *   - events + sessions:   ANALYTICS_RETENTION_DAYS      (60d, anonymous lane)
 *   - user_events:         ANALYTICS_USER_RETENTION_DAYS (180d, authenticated lane)
 *   - consent_events:      CONSENT_RETENTION_DAYS        (~13mo, GDPR Art. 7(1))
 *   - bot_hits:            BOT_HIT_RETENTION_DAYS        (180d, no personal data)
 *   - pairing_codes:       1h after expiry (unconsumed) / 7d after consumption
 *   - paired_admin_user_id: cleared 2h after pairedAt (hard cap)
 *
 * Everything lives in ONE job on purpose. Vercel Hobby rejects any cron that
 * fires more than once a day and fails the WHOLE deployment when it sees one,
 * so extra retention jobs would each cost a scarce daily slot. Retention is also
 * naturally batch work — there is nothing to gain from separate schedules.
 *
 * Returns the number of deleted anonymous events.
 */
export async function analyticsCleanup(): Promise<number> {
	const eventCutoff = new Date();
	eventCutoff.setDate(eventCutoff.getDate() - ANALYTICS_RETENTION_DAYS);

	const userEventCutoff = new Date();
	userEventCutoff.setDate(userEventCutoff.getDate() - ANALYTICS_USER_RETENTION_DAYS);

	const consentCutoff = new Date();
	consentCutoff.setDate(consentCutoff.getDate() - CONSENT_RETENTION_DAYS);

	const botHitCutoff = new Date();
	botHitCutoff.setDate(botHitCutoff.getDate() - BOT_HIT_RETENTION_DAYS);

	const pairingExpiredCutoff = new Date(Date.now() - 60 * 60 * 1000); // 1h
	const pairingConsumedCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7d
	const pairedSessionCutoff = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2h

	const [{ count: eventCount }] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(events)
		.where(lt(events.timestamp, eventCutoff));

	await db.delete(events).where(lt(events.timestamp, eventCutoff));
	await db.delete(sessions).where(lt(sessions.startedAt, eventCutoff));
	// Authenticated lane. Ages out on its own longer window; account deletion
	// erases it immediately via FK cascade, independently of this sweep.
	await db.delete(userEvents).where(lt(userEvents.timestamp, userEventCutoff));
	await db.delete(consentEvents).where(lt(consentEvents.timestamp, consentCutoff));

	// Bot lane. A longer window than the human lane because there is no data-
	// minimisation duty pulling the other way — the table holds no identifier of
	// any kind — and crawl cadence is only legible over months. Bounded all the
	// same: an append-only table with no sweep grows without limit, and this one is
	// fed by whatever chooses to point itself at the site.
	await db.delete(botHits).where(lt(botHits.timestamp, botHitCutoff));

	// Pairing codes: unconsumed past expiry (with grace) OR consumed past 7d.
	await db
		.delete(pairingCodes)
		.where(and(isNull(pairingCodes.consumedAt), lt(pairingCodes.expiresAt, pairingExpiredCutoff)));
	await db.delete(pairingCodes).where(lt(pairingCodes.consumedAt, pairingConsumedCutoff));

	// Stale paired sessions: clear pairing tag past hard 2h cap.
	await db
		.update(sessions)
		.set({ pairedAdminUserId: null, pairedAt: null })
		.where(and(isNotNull(sessions.pairedAt), lt(sessions.pairedAt, pairedSessionCutoff)));

	return Number(eventCount);
}
