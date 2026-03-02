/**
 * Analytics write operations — event recording and session management.
 */
import { db } from '$lib/server/db';
import { events, sessions } from '$lib/server/db/schema/analytics';
import { eq } from 'drizzle-orm';

/** Record a single analytics event */
export async function recordEvent(event: {
	sessionId: string;
	visitorId: string;
	eventType: 'pageview' | 'action' | 'error' | 'timing';
	path: string;
	referrer?: string;
	metadata?: Record<string, unknown>;
	consentTier?: 'necessary' | 'analytics' | 'full';
}) {
	await db.insert(events).values({
		sessionId: event.sessionId,
		visitorId: event.visitorId,
		eventType: event.eventType,
		path: event.path,
		referrer: event.referrer ?? null,
		metadata: event.metadata ?? null,
		consentTier: event.consentTier ?? 'necessary',
	});
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
				pageCount: session.pageCount ?? 1,
				endedAt: new Date(),
			},
		});
}

/** Close a session by setting endedAt */
export async function closeSession(sessionId: string) {
	await db
		.update(sessions)
		.set({ endedAt: new Date() })
		.where(eq(sessions.id, sessionId));
}
