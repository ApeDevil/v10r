import { db } from '$lib/server/db';
import { events } from '$lib/server/db/schema/analytics';
import { lt } from 'drizzle-orm';
import { ANALYTICS_RETENTION_DAYS } from '$lib/server/config';

/** Delete raw analytics events older than the retention window. */
export async function analyticsCleanup(): Promise<number> {
	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - ANALYTICS_RETENTION_DAYS);

	const deleted = await db
		.delete(events)
		.where(lt(events.timestamp, cutoff))
		.returning({ id: events.id });

	return deleted.length;
}
