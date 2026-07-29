/**
 * Analytics write operations — event recording and session management.
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { events, sessions } from '$lib/server/db/schema/analytics';

/**
 * Longest path we will store. Every real route is far shorter, and the bound is
 * not cosmetic: `events.path` carries `events_path_timestamp_idx`, and Postgres
 * refuses a btree entry over ~2704 bytes. An oversized path therefore does not
 * store badly — it makes the INSERT throw, inside a `waitUntil` whose `.catch`
 * swallows it. Silent, per-request, and reachable by anyone with a URL bar.
 */
const MAX_PATH_CHARS = 512;

/** Referrers are stored as bare origins, so this only has to survive a hostile URL. */
const MAX_REFERRER_CHARS = 256;

function boundPath(value: string): string {
	return value.length > MAX_PATH_CHARS ? value.slice(0, MAX_PATH_CHARS) : value;
}

/**
 * Reduce a referrer to its ORIGIN before it is ever stored.
 *
 * This is the single most sensitive thing the analytics pipeline touches. A
 * `Referer` header carries the full previous URL including its query string,
 * and the URLs users arrive from include magic-link, email-OTP, password-reset
 * and OAuth `code=` callbacks. Storing them whole put live credentials in a
 * table with 60-day retention that renders into the admin live-events panel.
 *
 * The SPA beacon lane already did exactly this, at
 * `api/analytics/journey/+server.ts`, with the comment "no query strings —
 * reset tokens etc. live there." The server-side pageview lane did not. Same
 * column, two lanes, opposite policy — so the rule now lives at the write
 * chokepoint where every lane inherits it rather than in whichever caller
 * remembered.
 *
 * An unparseable referrer is dropped rather than stored raw: a value we cannot
 * reduce to an origin is precisely the one we cannot vouch for.
 */
function toOrigin(referrer: string | undefined): string | undefined {
	if (!referrer) return undefined;
	try {
		return new URL(referrer).origin.slice(0, MAX_REFERRER_CHARS);
	} catch {
		return undefined;
	}
}

/** Record a single analytics event. If `eventId` is supplied, insert is idempotent on it. */
export async function recordEvent(event: {
	eventId?: string;
	sessionId: string;
	visitorId: string;
	eventType: 'pageview' | 'action' | 'error' | 'timing';
	path: string;
	/** Templated route — the bounded key aggregates group by. */
	route?: string;
	referrer?: string;
	metadata?: Record<string, string | number | boolean>;
	consentTier?: 'necessary' | 'analytics';
	debugOwnerId?: string | null;
	occurredAt?: Date;
}) {
	const insert = db.insert(events).values({
		eventId: event.eventId ?? null,
		sessionId: event.sessionId,
		visitorId: event.visitorId,
		eventType: event.eventType,
		path: boundPath(event.path),
		route: event.route ?? null,
		referrer: toOrigin(event.referrer) ?? null,
		metadata: event.metadata ?? null,
		consentTier: event.consentTier ?? 'necessary',
		debugOwnerId: event.debugOwnerId ?? null,
		...(event.occurredAt ? { timestamp: event.occurredAt } : {}),
	});
	if (event.eventId) {
		await insert.onConflictDoNothing({ target: events.eventId });
	} else {
		await insert;
	}
}

/**
 * Create or update a session record.
 *
 * `pageIncrement` exists because the SPA beacon delivers a whole batch of
 * navigations in one request: incrementing by 1 per call would undercount, and
 * calling this once per event would cost one round trip per navigation.
 */
export async function upsertSession(session: {
	id: string;
	visitorId: string;
	entryPath: string;
	exitPath?: string;
	pageCount?: number;
	/** Pages to add to an existing session's count. Defaults to 1. */
	pageIncrement?: number;
	device?: string;
	browser?: string;
	country?: string;
	consentTier?: 'necessary' | 'analytics';
	pairedAdminUserId?: string | null;
}) {
	const increment = session.pageIncrement ?? 1;
	await db
		.insert(sessions)
		.values({
			id: session.id,
			visitorId: session.visitorId,
			entryPath: boundPath(session.entryPath),
			exitPath: boundPath(session.exitPath ?? session.entryPath),
			pageCount: session.pageCount ?? increment,
			device: session.device ?? null,
			browser: session.browser ?? null,
			country: session.country ?? null,
			consentTier: session.consentTier ?? 'necessary',
			pairedAdminUserId: session.pairedAdminUserId ?? null,
			pairedAt: session.pairedAdminUserId ? new Date() : null,
		})
		.onConflictDoUpdate({
			target: sessions.id,
			set: {
				exitPath: boundPath(session.exitPath ?? session.entryPath),
				pageCount: sql<number>`${sessions.pageCount} + ${increment}`,
				endedAt: new Date(),
				// Backfill only. These are stable for the life of a session, but they
				// can become KNOWN mid-session — device/browser are gated on analytics
				// consent, so a visitor who accepts partway through has a session row
				// that started without them. Spreading conditionally means a later
				// write can fill a gap but a consent withdrawal never wipes what was
				// lawfully collected earlier.
				...(session.country ? { country: session.country } : {}),
				...(session.device ? { device: session.device } : {}),
				...(session.browser ? { browser: session.browser } : {}),
			},
		});
}

/** Close a session by setting endedAt */
export async function closeSession(sessionId: string) {
	await db.update(sessions).set({ endedAt: new Date() }).where(eq(sessions.id, sessionId));
}
