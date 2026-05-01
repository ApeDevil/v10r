/**
 * Feedback domain — pure business logic, no framework imports.
 * Called from /feedback form action and from /admin/feedback views.
 */
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { createId } from '$lib/server/db/id';
import { events, sessions } from '$lib/server/db/schema/analytics';
import { feedback, type feedbackStatusEnum } from '$lib/server/db/schema/feedback';

type FeedbackStatus = (typeof feedbackStatusEnum.enumValues)[number];

export interface SubmitFeedbackInput {
	subject: string;
	body: string;
	rating: number | null;
	contactEmail: string | null;
	pageOfOrigin: string;
	sessionId: string | null;
	nonce: string;
}

export interface SubmitFeedbackResult {
	id: string;
	deduplicated: boolean;
}

/**
 * Insert a feedback row. Idempotent on `nonce` — a replayed submission returns
 * the existing row's id with deduplicated=true rather than creating a duplicate.
 */
export async function submitFeedback(input: SubmitFeedbackInput): Promise<SubmitFeedbackResult> {
	const id = createId.feedback();
	const inserted = await db
		.insert(feedback)
		.values({
			id,
			subject: input.subject,
			body: input.body,
			rating: input.rating,
			contactEmail: input.contactEmail,
			pageOfOrigin: input.pageOfOrigin,
			sessionId: input.sessionId,
			nonce: input.nonce,
		})
		.onConflictDoNothing({ target: feedback.nonce })
		.returning({ id: feedback.id });

	if (inserted.length > 0) {
		return { id: inserted[0].id, deduplicated: false };
	}

	const existing = await db.select({ id: feedback.id }).from(feedback).where(eq(feedback.nonce, input.nonce)).limit(1);

	return { id: existing[0]?.id ?? id, deduplicated: true };
}

export interface ListFeedbackFilters {
	status?: FeedbackStatus;
	limit?: number;
	offset?: number;
}

export async function listFeedback(filters: ListFeedbackFilters = {}) {
	const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
	const offset = Math.max(filters.offset ?? 0, 0);

	const where = filters.status ? eq(feedback.status, filters.status) : undefined;

	const [items, totalRow] = await Promise.all([
		db
			.select({
				id: feedback.id,
				subject: feedback.subject,
				rating: feedback.rating,
				pageOfOrigin: feedback.pageOfOrigin,
				sessionId: feedback.sessionId,
				status: feedback.status,
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

export async function setFeedbackStatus(id: string, status: FeedbackStatus) {
	await db.update(feedback).set({ status }).where(eq(feedback.id, id));
}

export async function deleteFeedback(id: string) {
	await db.delete(feedback).where(eq(feedback.id, id));
}

/** Counts by status — for admin dashboard tiles. */
export async function getFeedbackCounts() {
	const rows = await db
		.select({ status: feedback.status, count: sql<number>`count(*)::int` })
		.from(feedback)
		.groupBy(feedback.status);
	const counts: Record<FeedbackStatus, number> = { new: 0, read: 0, archived: 0 };
	for (const row of rows) {
		counts[row.status as FeedbackStatus] = Number(row.count);
	}
	return counts;
}
