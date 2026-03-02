/**
 * Analytics read queries — raw table access for session detail views.
 */
import { db } from '$lib/server/db';
import { events, sessions } from '$lib/server/db/schema/analytics';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';

/** Get all events for a specific session, ordered by timestamp */
export async function getSessionEvents(sessionId: string) {
	return db
		.select()
		.from(events)
		.where(eq(events.sessionId, sessionId))
		.orderBy(events.timestamp);
}

/** Get a session timeline: sessions ordered by start time with optional date range */
export async function getSessionTimeline(opts: { from?: Date; to?: Date; limit?: number }) {
	const conditions = [];
	if (opts.from) conditions.push(gte(sessions.startedAt, opts.from));
	if (opts.to) conditions.push(lte(sessions.startedAt, opts.to));

	return db
		.select()
		.from(sessions)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(desc(sessions.startedAt))
		.limit(opts.limit ?? 50);
}

/** Get recent events for the live feed */
export async function getRecentEvents(limit = 20) {
	return db
		.select({
			id: events.id,
			sessionId: events.sessionId,
			eventType: events.eventType,
			path: events.path,
			metadata: events.metadata,
			timestamp: events.timestamp,
		})
		.from(events)
		.orderBy(desc(events.timestamp))
		.limit(limit);
}

/** Count active sessions in a time window */
export async function getActiveSessionCount(windowMs: number) {
	const cutoff = new Date(Date.now() - windowMs);
	const result = await db
		.select({ count: sql<number>`count(*)` })
		.from(sessions)
		.where(gte(sessions.startedAt, cutoff));
	return result[0]?.count ?? 0;
}
