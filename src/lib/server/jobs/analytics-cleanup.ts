import { and, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	botHits,
	consentEvents,
	dailyPageStats,
	events,
	pairingCodes,
	sessions,
	userEvents,
} from '$lib/server/db/schema/analytics';
import { retentionCutoff } from '$lib/server/retention';

/**
 * Delete expired analytics rows. Every window comes from `retention/schedule.ts`;
 * the pairing-code grace periods below do not, because a pairing code carries its
 * own `expires_at` — it is garbage collection, not a retention promise.
 *
 * Everything lives in ONE job on purpose. Vercel Hobby rejects any cron that
 * fires more than once a day and fails the WHOLE deployment when it sees one,
 * so extra retention jobs would each cost a scarce daily slot. Retention is also
 * naturally batch work — there is nothing to gain from separate schedules.
 *
 * Returns the number of deleted anonymous events.
 */
export async function analyticsCleanup(): Promise<number> {
	const eventCutoff = retentionCutoff('analytics-events');
	const sessionCutoff = retentionCutoff('analytics-sessions');
	const userEventCutoff = retentionCutoff('analytics-user-events');
	const consentCutoff = retentionCutoff('consent-events');
	const botHitCutoff = retentionCutoff('bot-hits');

	const pairingExpiredCutoff = new Date(Date.now() - 60 * 60 * 1000); // 1h
	const pairingConsumedCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7d
	const pairedSessionCutoff = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2h

	const [{ count: eventCount }] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(events)
		.where(lt(events.timestamp, eventCutoff));

	await db.delete(events).where(lt(events.timestamp, eventCutoff));
	await db.delete(sessions).where(lt(sessions.startedAt, sessionCutoff));
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

	// Rollup aggregates. This window was promised on the public privacy page for
	// months while nothing enforced it — the constant existed, the sweep did not.
	// The column is a `date` in string mode, so the cutoff is compared as a
	// calendar date, not a timestamp.
	const aggregateCutoff = retentionCutoff('analytics-aggregates');
	await db.delete(dailyPageStats).where(lt(dailyPageStats.date, aggregateCutoff.toISOString().slice(0, 10)));

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
