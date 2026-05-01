import { lt, sql } from 'drizzle-orm';
import { ANALYTICS_RETENTION_DAYS, CONSENT_RETENTION_DAYS } from '$lib/server/config';
import { db } from '$lib/server/db';
import { consentEvents, events, sessions } from '$lib/server/db/schema/analytics';

/**
 * Delete expired analytics rows. Per-table retention:
 *   - events + sessions: ANALYTICS_RETENTION_DAYS (60d)
 *   - consent_events:    CONSENT_RETENTION_DAYS  (~13mo, GDPR Art. 7(1))
 * Returns the total number of deleted events (the same return shape the previous
 * version had — admin tile reports this as "rows removed").
 */
export async function analyticsCleanup(): Promise<number> {
	const eventCutoff = new Date();
	eventCutoff.setDate(eventCutoff.getDate() - ANALYTICS_RETENTION_DAYS);

	const consentCutoff = new Date();
	consentCutoff.setDate(consentCutoff.getDate() - CONSENT_RETENTION_DAYS);

	const [{ count: eventCount }] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(events)
		.where(lt(events.timestamp, eventCutoff));

	await db.delete(events).where(lt(events.timestamp, eventCutoff));
	await db.delete(sessions).where(lt(sessions.startedAt, eventCutoff));
	await db.delete(consentEvents).where(lt(consentEvents.timestamp, consentCutoff));

	return Number(eventCount);
}
