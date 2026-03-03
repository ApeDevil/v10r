import { db } from '$lib/server/db';
import { events, sessions } from '$lib/server/db/schema/analytics';
import { lt, sql } from 'drizzle-orm';
import { ANALYTICS_RETENTION_DAYS } from '$lib/server/config';

/** Delete raw analytics events and sessions older than the retention window. */
export async function analyticsCleanup(): Promise<number> {
	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - ANALYTICS_RETENTION_DAYS);

	const [{ count: eventCount }] = await db
		.select({ count: sql<number>`count(*)` })
		.from(events)
		.where(lt(events.timestamp, cutoff));

	await db.delete(events).where(lt(events.timestamp, cutoff));
	await db.delete(sessions).where(lt(sessions.startedAt, cutoff));

	return Number(eventCount);
}
