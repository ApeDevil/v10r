/**
 * The admin inbox's read side: the paginated list, one item, its journey, the counts per
 * state and the possibly-related items beside it.
 */
import { and, count, desc, eq, ne, or, sql } from 'drizzle-orm';
import type { FeedbackCategory } from '#lib/feedback/category.ts';
import type { FeedbackStatus } from '#lib/feedback/status.ts';
import { db } from '#lib/server/db/index.ts';
import { events, sessions } from '#lib/server/db/schema/analytics/index.ts';
import { feedback, feedbackStatusEnum } from '#lib/server/db/schema/feedback/index.ts';
import { INBOX_PAGE_SIZE, RELATED_LIMIT, RELATED_WINDOW } from './config';

export interface ListFeedbackFilters {
	status?: FeedbackStatus;
	category?: FeedbackCategory;
	limit?: number;
	offset?: number;
}

export async function listFeedback(filters: ListFeedbackFilters = {}) {
	const limit = Math.min(Math.max(filters.limit ?? INBOX_PAGE_SIZE, 1), 200);
	const offset = Math.max(filters.offset ?? 0, 0);

	const where = and(
		filters.status ? eq(feedback.status, filters.status) : undefined,
		filters.category ? eq(feedback.category, filters.category) : undefined,
	);

	const [items, totalRow] = await Promise.all([
		db
			.select({
				id: feedback.id,
				category: feedback.category,
				subject: feedback.subject,
				rating: feedback.rating,
				pageOfOrigin: feedback.pageOfOrigin,
				routeId: feedback.routeId,
				sessionId: feedback.sessionId,
				signedIn: sql<boolean>`${feedback.userId} IS NOT NULL`,
				status: feedback.status,
				closeReason: feedback.closeReason,
				submittedAt: feedback.submittedAt,
			})
			.from(feedback)
			.where(where)
			.orderBy(desc(feedback.submittedAt))
			.limit(limit)
			.offset(offset),
		db.select({ count: sql<number>`count(*)::int` }).from(feedback).where(where),
	]);

	return { items, total: Number(totalRow[0]?.count ?? 0), limit, offset };
}

export async function getFeedback(id: string) {
	const rows = await db.select().from(feedback).where(eq(feedback.id, id)).limit(1);
	return rows[0] ?? null;
}

/**
 * Reconstruct journey for a feedback's session — empty array when sessionId is null.
 */
export async function getFeedbackJourney(sessionId: string | null) {
	if (!sessionId) return { session: null, events: [] as Array<{ path: string; timestamp: Date; eventType: string }> };
	const [sessionRow, eventRows] = await Promise.all([
		db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1),
		db
			.select({ path: events.path, timestamp: events.timestamp, eventType: events.eventType })
			.from(events)
			.where(eq(events.sessionId, sessionId))
			.orderBy(events.timestamp),
	]);
	return { session: sessionRow[0] ?? null, events: eventRows };
}

/** Counts by status — for the inbox filter bar. One grouped scan of the status index. */
export async function getFeedbackCounts() {
	const rows = await db.select({ status: feedback.status, count: count() }).from(feedback).groupBy(feedback.status);
	const counts = Object.fromEntries(feedbackStatusEnum.enumValues.map((s) => [s, 0])) as Record<FeedbackStatus, number>;
	for (const row of rows) counts[row.status] = Number(row.count);
	return counts;
}

/**
 * Items that may describe the same thing: the same error reference, or words of the subject
 * in another item's subject or body (Postgres full-text search, OR across the subject's
 * terms). Rows closed as duplicates are left out — their original is the one to link to.
 *
 * Searches the RELATED_WINDOW most recent items only, so one detail view costs the same at
 * any inbox size: no full-text index to maintain per write, and no full-table scan on read
 * (measured on Postgres 16 at 3,000 rows: 188 ms unbounded, 28 ms windowed).
 */
export async function findRelatedFeedback(item: { id: string; subject: string; errorId: string | null }) {
	const recent = db.$with('recent').as(
		db
			.select({
				id: feedback.id,
				subject: feedback.subject,
				body: feedback.body,
				category: feedback.category,
				status: feedback.status,
				closeReason: feedback.closeReason,
				errorId: feedback.errorId,
				submittedAt: feedback.submittedAt,
			})
			.from(feedback)
			.where(ne(feedback.id, item.id))
			.orderBy(desc(feedback.submittedAt))
			.limit(RELATED_WINDOW),
	);
	const document = sql`to_tsvector('english', ${recent.subject} || ' ' || ${recent.body})`;
	const query = sql`to_tsquery('english', replace(plainto_tsquery('english', ${item.subject})::text, ' & ', ' | '))`;
	const textMatch = sql`${document} @@ ${query}`;
	const errorMatch = item.errorId ? eq(recent.errorId, item.errorId) : undefined;
	return db
		.with(recent)
		.select({
			id: recent.id,
			subject: recent.subject,
			category: recent.category,
			status: recent.status,
			submittedAt: recent.submittedAt,
			sameError: item.errorId
				? sql<boolean>`${recent.errorId} IS NOT DISTINCT FROM ${item.errorId}`
				: sql<boolean>`false`,
		})
		.from(recent)
		.where(
			and(sql`${recent.closeReason} IS DISTINCT FROM 'duplicate'`, errorMatch ? or(errorMatch, textMatch) : textMatch),
		)
		.orderBy(desc(sql`ts_rank(${document}, ${query})`), desc(recent.submittedAt))
		.limit(RELATED_LIMIT);
}
