/**
 * The public write path (/feedback) and the submitter's own read path (/account/feedback).
 */
import { count, desc, eq, sql } from 'drizzle-orm';
import type { FeedbackCategory } from '#lib/feedback/category.ts';
import type { FeedbackStatus, SubmitterStatus } from '#lib/feedback/status.ts';
import { createId } from '#lib/server/db/id.ts';
import { db } from '#lib/server/db/index.ts';
import { feedback } from '#lib/server/db/schema/feedback/index.ts';
import { INBOX_CAPACITY, INBOX_PAGE_SIZE, STORAGE_CEILING } from './config';

/**
 * What the submitter explicitly agreed to attach. `null` = the box was unticked, and then
 * none of these is stored, however much of it the request carried.
 */
export interface FeedbackTechnicalContext {
	pageOfOrigin: string;
	routeId: string;
	appVersion: string;
	errorId: string;
	sessionId: string | null;
}

export interface SubmitFeedbackInput {
	category: FeedbackCategory;
	subject: string;
	body: string;
	rating: number | null;
	contactEmail: string | null;
	/** The signed-in submitter, or null for an anonymous visitor. */
	userId: string | null;
	technicalContext: FeedbackTechnicalContext | null;
	nonce: string;
}

export type SubmitFeedbackResult =
	| { ok: true; id: string; deduplicated: boolean }
	/** The untriaged backlog is at INBOX_CAPACITY, or the table at STORAGE_CEILING. */
	| { ok: false; refusal: 'inbox_full' };

const orNull = (value: string | undefined) => (value ? value : null);

/**
 * Insert a feedback row: one count, one insert. Idempotent on `nonce` — a replayed
 * submission returns the existing row's id with deduplicated=true rather than creating a
 * duplicate.
 */
export async function submitFeedback(input: SubmitFeedbackInput): Promise<SubmitFeedbackResult> {
	// Both bounds in one scan. A race past them by a few rows is harmless: they bound
	// growth, they are not exact quotas.
	const [load] = await db
		.select({
			waiting: sql<number>`count(*) FILTER (WHERE ${feedback.status} = 'received')`.mapWith(Number),
			stored: count(),
		})
		.from(feedback);
	if ((load?.waiting ?? 0) >= INBOX_CAPACITY || (load?.stored ?? 0) >= STORAGE_CEILING) {
		return { ok: false, refusal: 'inbox_full' };
	}

	const context = input.technicalContext;
	const id = createId.feedback();
	const inserted = await db
		.insert(feedback)
		.values({
			id,
			category: input.category,
			subject: input.subject,
			body: input.body,
			rating: input.rating,
			contactEmail: input.contactEmail,
			userId: input.userId,
			pageOfOrigin: context?.pageOfOrigin ?? '',
			routeId: orNull(context?.routeId),
			appVersion: orNull(context?.appVersion?.slice(0, 64)),
			errorId: orNull(context?.errorId),
			sessionId: context?.sessionId ?? null,
			nonce: input.nonce,
		})
		.onConflictDoNothing({ target: feedback.nonce })
		.returning({ id: feedback.id });

	if (inserted.length > 0) return { ok: true, id: inserted[0].id, deduplicated: false };

	// A replay of the same form render (double submit, back-and-resend).
	const [first] = await db.select({ id: feedback.id }).from(feedback).where(eq(feedback.nonce, input.nonce)).limit(1);
	return { ok: true, id: first?.id ?? id, deduplicated: true };
}

/**
 * What the submitter sees of the lifecycle: coarse, and nothing that reveals the admin's
 * working detail (review, release approval, close reason).
 */
export function submitterStatus(status: FeedbackStatus): SubmitterStatus {
	switch (status) {
		case 'received':
			return 'received';
		case 'deferred':
			return 'considering';
		case 'accepted':
			return 'planned';
		case 'in_development':
		case 'ready_for_review':
		case 'release_approved':
			return 'in_progress';
		case 'released':
			return 'released';
		case 'closed':
			return 'closed';
	}
}

/** "My feedback": the account's own rows, newest first. Never the triage note. */
export async function listOwnFeedback(userId: string, opts: { offset?: number } = {}) {
	const offset = Math.max(opts.offset ?? 0, 0);
	const where = eq(feedback.userId, userId);
	const [rows, totalRow] = await Promise.all([
		db
			.select({
				id: feedback.id,
				category: feedback.category,
				subject: feedback.subject,
				status: feedback.status,
				submittedAt: feedback.submittedAt,
			})
			.from(feedback)
			.where(where)
			.orderBy(desc(feedback.submittedAt))
			.limit(INBOX_PAGE_SIZE)
			.offset(offset),
		db.select({ value: count() }).from(feedback).where(where),
	]);
	return {
		items: rows.map(({ status, ...row }) => ({ ...row, status: submitterStatus(status) })),
		total: totalRow[0]?.value ?? 0,
		limit: INBOX_PAGE_SIZE,
		offset,
	};
}
