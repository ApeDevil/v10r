/**
 * Analytics read queries — raw table access for session detail views and live feed.
 */

import { and, asc, desc, eq, gt, gte, isNotNull, lte, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { events, sessions } from '$lib/server/db/schema/analytics';
import type { LiveEvent } from '$lib/types/analytics-live';

export type { LiveEvent } from '$lib/types/analytics-live';

/** Get all events for a specific session, ordered by timestamp */
export async function getSessionEvents(sessionId: string) {
	return db.select().from(events).where(eq(events.sessionId, sessionId)).orderBy(events.timestamp).limit(1000);
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

export interface RecentEventsOptions {
	adminUserId: string;
	sinceId?: number;
	filter?: 'all' | 'paired';
	limit?: number;
	/** Window in seconds — events older than this are excluded. */
	windowSec?: number;
}

/**
 * Live-feed query. Returns events newer than `sinceId`, joined with their session
 * for paired/device/country context. Consent-tier-gated: fields the visitor
 * didn't authorize are returned as null.
 */
export async function getRecentEvents(opts: RecentEventsOptions): Promise<LiveEvent[]> {
	const sinceId = opts.sinceId ?? 0;
	const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
	const windowCutoff = new Date(Date.now() - (opts.windowSec ?? 300) * 1000);

	const conditions = [gt(events.id, sinceId), gt(events.timestamp, windowCutoff)];
	if (opts.filter === 'paired') {
		conditions.push(eq(events.debugOwnerId, opts.adminUserId));
	}

	const rows = await db
		.select({
			id: events.id,
			ts: events.timestamp,
			sessionId: events.sessionId,
			visitorId: events.visitorId,
			path: events.path,
			consentTier: events.consentTier,
			debugOwnerId: events.debugOwnerId,
			device: sessions.device,
			country: sessions.country,
		})
		.from(events)
		.innerJoin(sessions, eq(events.sessionId, sessions.id))
		.where(and(...conditions))
		.orderBy(asc(events.id))
		.limit(limit);

	return rows.map((r) => {
		const tier = r.consentTier;
		const showDevice = tier === 'analytics' || tier === 'full';
		const showCountry = tier === 'analytics' || tier === 'full';
		return {
			id: r.id,
			ts: r.ts.toISOString(),
			sessionId: r.sessionId,
			visitorFragment: r.visitorId.slice(0, 10),
			path: r.path,
			device: showDevice ? r.device : null,
			country: showCountry ? r.country : null,
			consentTier: tier,
			isPaired: r.debugOwnerId === opts.adminUserId,
		};
	});
}

/** Count active sessions: sessions with `endedAt` (last activity) in the last 5 min. */
export async function getActiveSessionCount(opts?: { adminUserId?: string }): Promise<number> {
	const cutoff = new Date(Date.now() - 5 * 60 * 1000);
	const conditions = [gte(sessions.endedAt, cutoff)];
	if (opts?.adminUserId) conditions.push(eq(sessions.pairedAdminUserId, opts.adminUserId));
	const result = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(sessions)
		.where(and(...conditions));
	return Number(result[0]?.count ?? 0);
}

/** Count of currently paired sessions for an admin (pairedAt within 2h, recent activity). */
export async function getPairedSessionCount(adminUserId: string): Promise<number> {
	const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
	const result = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(sessions)
		.where(
			and(eq(sessions.pairedAdminUserId, adminUserId), isNotNull(sessions.pairedAt), gt(sessions.pairedAt, cutoff)),
		);
	return Number(result[0]?.count ?? 0);
}
