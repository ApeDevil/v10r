/**
 * Analytics write operations — event recording and session management.
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { events, sessions } from '$lib/server/db/schema/analytics';

/** Record a single analytics event. If `eventId` is supplied, insert is idempotent on it. */
export async function recordEvent(event: {
	eventId?: string;
	sessionId: string;
	visitorId: string;
	eventType: 'pageview' | 'action' | 'error' | 'timing';
	path: string;
	referrer?: string;
	metadata?: Record<string, unknown>;
	consentTier?: 'necessary' | 'analytics' | 'full';
	occurredAt?: Date;
}) {
	const insert = db.insert(events).values({
		eventId: event.eventId ?? null,
		sessionId: event.sessionId,
		visitorId: event.visitorId,
		eventType: event.eventType,
		path: event.path,
		referrer: event.referrer ?? null,
		metadata: event.metadata ?? null,
		consentTier: event.consentTier ?? 'necessary',
		...(event.occurredAt ? { timestamp: event.occurredAt } : {}),
	});
	if (event.eventId) {
		await insert.onConflictDoNothing({ target: events.eventId });
	} else {
		await insert;
	}
}

/** Create or update a session record */
export async function upsertSession(session: {
	id: string;
	visitorId: string;
	entryPath: string;
	exitPath?: string;
	pageCount?: number;
	device?: string;
	browser?: string;
	country?: string;
	consentTier?: 'necessary' | 'analytics' | 'full';
}) {
	await db
		.insert(sessions)
		.values({
			id: session.id,
			visitorId: session.visitorId,
			entryPath: session.entryPath,
			exitPath: session.exitPath ?? session.entryPath,
			pageCount: session.pageCount ?? 1,
			device: session.device ?? null,
			browser: session.browser ?? null,
			country: session.country ?? null,
			consentTier: session.consentTier ?? 'necessary',
		})
		.onConflictDoUpdate({
			target: sessions.id,
			set: {
				exitPath: session.exitPath ?? session.entryPath,
				pageCount: sql<number>`${sessions.pageCount} + 1`,
				endedAt: new Date(),
			},
		});
}

/** Close a session by setting endedAt */
export async function closeSession(sessionId: string) {
	await db.update(sessions).set({ endedAt: new Date() }).where(eq(sessions.id, sessionId));
}
