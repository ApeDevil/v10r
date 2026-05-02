import { and, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import { ANALYTICS_RETENTION_DAYS, CONSENT_RETENTION_DAYS } from '$lib/server/config';
import { db } from '$lib/server/db';
import { consentEvents, events, pairingCodes, sessions } from '$lib/server/db/schema/analytics';

/**
 * Delete expired analytics rows. Per-table retention:
 *   - events + sessions:   ANALYTICS_RETENTION_DAYS (60d)
 *   - consent_events:      CONSENT_RETENTION_DAYS  (~13mo, GDPR Art. 7(1))
 *   - pairing_codes:       1h after expiry (unconsumed) / 7d after consumption
 *   - paired_admin_user_id: cleared 2h after pairedAt (hard cap)
 * Returns the total number of deleted events.
 */
export async function analyticsCleanup(): Promise<number> {
	const eventCutoff = new Date();
	eventCutoff.setDate(eventCutoff.getDate() - ANALYTICS_RETENTION_DAYS);

	const consentCutoff = new Date();
	consentCutoff.setDate(consentCutoff.getDate() - CONSENT_RETENTION_DAYS);

	const pairingExpiredCutoff = new Date(Date.now() - 60 * 60 * 1000); // 1h
	const pairingConsumedCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7d
	const pairedSessionCutoff = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2h

	const [{ count: eventCount }] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(events)
		.where(lt(events.timestamp, eventCutoff));

	await db.delete(events).where(lt(events.timestamp, eventCutoff));
	await db.delete(sessions).where(lt(sessions.startedAt, eventCutoff));
	await db.delete(consentEvents).where(lt(consentEvents.timestamp, consentCutoff));

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
