/**
 * Analytics write operations — event recording and session management.
 */

import { and, eq, isNull, type SQL, sql } from 'drizzle-orm';
import { normalizeIpForVerification } from '$lib/server/analytics/bot-ranges';
import { db } from '$lib/server/db';
import { events, sessions } from '$lib/server/db/schema/analytics';
import type { ConsentTier } from '$lib/types/db-enums';

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

export interface RecordEventInput {
	eventId?: string;
	sessionId: string;
	visitorId: string;
	eventType: 'pageview' | 'action' | 'error' | 'timing';
	path: string;
	/** Templated route — the bounded key aggregates group by. */
	route?: string;
	referrer?: string;
	metadata?: Record<string, string | number | boolean>;
	consentTier?: ConsentTier;
	debugOwnerId?: string | null;
	occurredAt?: Date;
}

/** Shared row shape so the batch path can never drift from the single-event path. */
function toEventRow(event: RecordEventInput) {
	return {
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
	};
}

/** Record a single analytics event. If `eventId` is supplied, insert is idempotent on it. */
export async function recordEvent(event: RecordEventInput) {
	const insert = db.insert(events).values(toEventRow(event));
	if (event.eventId) {
		await insert.onConflictDoNothing({ target: events.eventId });
	} else {
		await insert;
	}
}

/**
 * Record a whole batch in ONE statement.
 *
 * The SPA beacon delivers up to 50 events per request. Inserting them one-by-one
 * cost 50 round trips, not 50 cheap statements: `neonConfig.poolQueryViaFetch`
 * (see db/index.ts) routes every query over its own HTTPS request, so a batch of
 * 50 opened 50 connections to Neon from a single serverless invocation and paid
 * full request latency on each. `Promise.all` made them concurrent, not fewer.
 *
 * `onConflictDoNothing` is evaluated per row by Postgres, so re-delivered beacons
 * stay idempotent exactly as they were per-event. Rows without an `eventId` go in
 * a separate statement because the conflict target only applies to the others.
 */
export async function recordEvents(batch: RecordEventInput[]) {
	if (batch.length === 0) return;

	const identified = batch.filter((e) => e.eventId);
	const anonymous = batch.filter((e) => !e.eventId);

	await Promise.all([
		identified.length > 0
			? db.insert(events).values(identified.map(toEventRow)).onConflictDoNothing({ target: events.eventId })
			: null,
		anonymous.length > 0 ? db.insert(events).values(anonymous.map(toEventRow)) : null,
	]);
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
	consentTier?: ConsentTier;
	pairedAdminUserId?: string | null;
	/**
	 * Permanent debug attribution, unlike `pairedAdminUserId` (which the cleanup
	 * reaper NULLs after the 2h streaming cap). Backfill-only below, never
	 * cleared — aggregates exclude on this column for the whole retention window.
	 */
	debugOwnerId?: string | null;
	/**
	 * JS corroboration carried by a beacon write (the batch itself proves the
	 * client ran). COALESCE'd below: the FIRST confirmation timestamp wins, a
	 * later batch never advances it.
	 */
	humanConfirmedAt?: Date;
	/**
	 * Used ONLY for the ip_class containment test below — compared against the
	 * published ranges inside the INSERT and never stored, the same lifetime
	 * contract as `recordBotHit`. Omit it and ip_class stays untouched.
	 */
	clientIp?: string | null;
}) {
	const increment = session.pageIncrement ?? 1;

	// Connection-origin class, computed in the same statement as the write (the
	// bot-mutations pattern: the verdict is computed where the data is, one
	// round trip). Relay is checked FIRST — Apple's egress ranges ride
	// commercial cloud space, so datacenter-first would misclassify every
	// Private Relay user. An empty range table yields NULL ("never classified"),
	// not 'unknown' — absence of the feed is not a finding about the visitor.
	const comparableIp = normalizeIpForVerification(session.clientIp);
	const ipClassExpr: SQL | null =
		comparableIp === null
			? null
			: sql`CASE
					WHEN NOT EXISTS (SELECT 1 FROM analytics.datacenter_ip_ranges) THEN NULL
					WHEN EXISTS (
						SELECT 1 FROM analytics.datacenter_ip_ranges
						WHERE source = 'icloud_relay' AND ${comparableIp}::inet <<= prefix::cidr
					) THEN 'icloud_relay'::analytics.ip_class
					WHEN EXISTS (
						SELECT 1 FROM analytics.datacenter_ip_ranges
						WHERE source <> 'icloud_relay' AND ${comparableIp}::inet <<= prefix::cidr
					) THEN 'datacenter'::analytics.ip_class
					ELSE 'unknown'::analytics.ip_class
				END`;
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
			debugOwnerId: session.debugOwnerId ?? null,
			humanConfirmedAt: session.humanConfirmedAt ?? null,
			...(ipClassExpr ? { ipClass: ipClassExpr } : {}),
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
				...(session.debugOwnerId ? { debugOwnerId: session.debugOwnerId } : {}),
				...(session.humanConfirmedAt
					? { humanConfirmedAt: sql`COALESCE(${sessions.humanConfirmedAt}, ${session.humanConfirmedAt})` }
					: {}),
				// Backfill-only, like the rest: the first classification wins, and an
				// update without an IP never wipes one.
				...(ipClassExpr ? { ipClass: sql`COALESCE(${sessions.ipClass}, EXCLUDED.ip_class)` } : {}),
			},
		});
}

/**
 * Mark a session JS-corroborated. UPDATE, not upsert, on purpose: the confirm
 * ping's payload is constant (no entry path exists to seed a row with), so a
 * ping that races ahead of the hook's deferred session write is a conservative
 * no-op — the session stays unconfirmed rather than half-created. Idempotent:
 * the first confirmation timestamp wins.
 */
export async function confirmSession(sessionId: string): Promise<void> {
	await db
		.update(sessions)
		.set({ humanConfirmedAt: new Date() })
		.where(and(eq(sessions.id, sessionId), isNull(sessions.humanConfirmedAt)));
}
