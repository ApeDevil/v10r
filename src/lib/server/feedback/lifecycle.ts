/**
 * The feedback lifecycle's triage half: every admin transition, the triage note, deletion
 * and the on-demand purge. Each runs as one transaction that locks the row, checks the
 * from-state, writes the change and its audit row together — a double click or two admins
 * racing change the row once and leave one audit entry. The development half (Gate 1, the
 * implementation report, Gate 2) is Slice 2 and is not here.
 *
 * Audit rows carry ids, states and reasons only, never the submitter's subject, body or the
 * note's text: the audit log outlives an account erasure and must not keep its words.
 */
import { and, asc, eq, inArray, lt } from 'drizzle-orm';
import type { FeedbackCloseReason, FeedbackStatus } from '#lib/feedback/status.ts';
import { recordAuditEvent } from '#lib/server/admin/index.ts';
import { type DbHandle, db } from '#lib/server/db/index.ts';
import { ENGINEERING_STATUSES, feedback } from '#lib/server/db/schema/feedback/index.ts';
import { CLOSED_PURGE_DAYS } from './config';

/** The admin acting — the shape `getAuditContext` returns. */
export interface FeedbackActor {
	actorId: string;
	actorEmail: string;
	ipAddress?: string;
}

export type TriageAction =
	| { kind: 'accept' }
	| { kind: 'defer' }
	| { kind: 'reopen' }
	| { kind: 'close'; reason: 'rejected' | 'archived' }
	| { kind: 'mark_duplicate'; duplicateOf: string };

export type TriageActionKind = TriageAction['kind'];

/**
 * The triage transitions: action → the states it may start from. The target is fixed per
 * action. Development states are absent on purpose — no triage action may move an item into
 * or out of the development slot; that is Slice 2's Gate 1 and its explicit decisions.
 */
export const TRIAGE_TRANSITIONS = {
	accept: { from: ['received', 'deferred'], to: 'accepted' },
	defer: { from: ['received', 'accepted'], to: 'deferred' },
	reopen: { from: ['deferred', 'closed'], to: 'received' },
	close: { from: ['received', 'deferred', 'accepted'], to: 'closed' },
	mark_duplicate: { from: ['received', 'deferred', 'accepted'], to: 'closed' },
} as const satisfies Record<TriageActionKind, { from: readonly FeedbackStatus[]; to: FeedbackStatus }>;

export function allowedTriageActions(status: FeedbackStatus): TriageActionKind[] {
	return (Object.keys(TRIAGE_TRANSITIONS) as TriageActionKind[]).filter((kind) =>
		(TRIAGE_TRANSITIONS[kind].from as readonly FeedbackStatus[]).includes(status),
	);
}

export type TriageRefusal =
	| { refusal: 'not_found' }
	/** The row is no longer in a state this action starts from — usually a second click. */
	| { refusal: 'invalid_transition'; current: FeedbackStatus }
	/** Missing, itself, or itself closed as a duplicate. */
	| { refusal: 'invalid_duplicate_target' }
	/** Other items are duplicates of this one: it is an original and stays one. */
	| { refusal: 'has_duplicates' };

export type TriageResult = { ok: true; from: FeedbackStatus; to: FeedbackStatus } | ({ ok: false } & TriageRefusal);

async function lockRow(handle: DbHandle, id: string) {
	const [row] = await handle
		.select({ id: feedback.id, status: feedback.status })
		.from(feedback)
		.where(eq(feedback.id, id))
		.for('update');
	return row ?? null;
}

async function lockRows(handle: DbHandle, ids: string[]) {
	await handle
		.select({ id: feedback.id })
		.from(feedback)
		.where(inArray(feedback.id, ids))
		.orderBy(asc(feedback.id))
		.for('update');
}

/**
 * The duplicate rule: every link is one hop from a duplicate to an original. An original is
 * never itself a duplicate, and an item with duplicates never becomes one, so there are no
 * chains and therefore no cycles. Runs with both rows locked: whoever links second reads the
 * first link and is refused.
 */
async function checkDuplicateLink(
	handle: DbHandle,
	id: string,
	targetId: string,
): Promise<'invalid_duplicate_target' | 'has_duplicates' | null> {
	if (targetId === id) return 'invalid_duplicate_target';
	const [target] = await handle
		.select({ closeReason: feedback.closeReason })
		.from(feedback)
		.where(eq(feedback.id, targetId));
	if (!target || target.closeReason === 'duplicate') return 'invalid_duplicate_target';
	const [incoming] = await handle
		.select({ id: feedback.id })
		.from(feedback)
		.where(eq(feedback.duplicateOf, id))
		.limit(1);
	return incoming ? 'has_duplicates' : null;
}

export async function applyTriageAction(id: string, action: TriageAction, actor: FeedbackActor): Promise<TriageResult> {
	const transition = TRIAGE_TRANSITIONS[action.kind];
	return db.transaction(async (tx): Promise<TriageResult> => {
		// Marking a duplicate locks the original too, both in id order: two admins linking
		// the same pair opposite ways queue up instead of deadlocking.
		if (action.kind === 'mark_duplicate') await lockRows(tx, [id, action.duplicateOf]);
		const row = await lockRow(tx, id);
		if (!row) return { ok: false, refusal: 'not_found' };
		if (!(transition.from as readonly FeedbackStatus[]).includes(row.status)) {
			return { ok: false, refusal: 'invalid_transition', current: row.status };
		}

		let closeReason: FeedbackCloseReason | null = null;
		let duplicateOf: string | null = null;
		if (action.kind === 'close') closeReason = action.reason;
		if (action.kind === 'mark_duplicate') {
			const refusal = await checkDuplicateLink(tx, id, action.duplicateOf);
			if (refusal) return { ok: false, refusal };
			closeReason = 'duplicate';
			duplicateOf = action.duplicateOf;
		}

		await tx
			.update(feedback)
			.set({ status: transition.to, closeReason, duplicateOf, statusChangedAt: new Date() })
			.where(eq(feedback.id, id));

		await recordAuditEvent(
			{
				actorId: actor.actorId,
				actorEmail: actor.actorEmail,
				action: `feedback.${action.kind}`,
				targetType: 'feedback.feedback',
				targetId: id,
				detail: { from: row.status, to: transition.to, closeReason, duplicateOf },
				ipAddress: actor.ipAddress,
			},
			tx,
		);
		return { ok: true, from: row.status, to: transition.to };
	});
}

/** Replace the admin's note. An unchanged note writes nothing and audits nothing. */
export async function setTriageNote(
	id: string,
	note: string,
	actor: FeedbackActor,
): Promise<{ ok: true; changed: boolean } | { ok: false; refusal: 'not_found' }> {
	const value = note.trim() === '' ? null : note.trim();
	return db.transaction(async (tx) => {
		const [row] = await tx
			.select({ triageNote: feedback.triageNote, erasedAt: feedback.erasedAt })
			.from(feedback)
			.where(eq(feedback.id, id))
			.for('update');
		if (!row) return { ok: false as const, refusal: 'not_found' as const };
		if ((row.triageNote ?? null) === value) return { ok: true as const, changed: false };
		await tx.update(feedback).set({ triageNote: value }).where(eq(feedback.id, id));
		await recordAuditEvent(
			{
				actorId: actor.actorId,
				actorEmail: actor.actorEmail,
				action: 'feedback.note',
				targetType: 'feedback.feedback',
				targetId: id,
				detail: { length: value?.length ?? 0 },
				ipAddress: actor.ipAddress,
			},
			tx,
		);
		return { ok: true as const, changed: true };
	});
}

const engineeringStatuses: readonly FeedbackStatus[] = ENGINEERING_STATUSES;

/** Whether the row holds engineering state (the development slot, or a release). */
export function isEngineeringStatus(status: FeedbackStatus): boolean {
	return engineeringStatuses.includes(status);
}

/**
 * Hard delete by an admin. Refused while the row holds engineering state: deleting it would
 * free the development slot or drop what a pending release needs, without the explicit
 * decision a transition records.
 */
export async function deleteFeedback(
	id: string,
	actor: FeedbackActor,
): Promise<
	| { ok: true }
	| { ok: false; refusal: 'not_found' }
	| { ok: false; refusal: 'engineering_state'; current: FeedbackStatus }
> {
	return db.transaction(async (tx) => {
		const row = await lockRow(tx, id);
		if (!row) return { ok: false as const, refusal: 'not_found' as const };
		if (isEngineeringStatus(row.status)) {
			return { ok: false as const, refusal: 'engineering_state' as const, current: row.status };
		}
		await tx.delete(feedback).where(eq(feedback.id, id));
		await recordAuditEvent(
			{
				actorId: actor.actorId,
				actorEmail: actor.actorEmail,
				action: 'feedback.delete',
				targetType: 'feedback.feedback',
				targetId: id,
				detail: { status: row.status },
				ipAddress: actor.ipAddress,
			},
			tx,
		);
		return { ok: true as const };
	});
}

/** The purge cutoff: closed rows whose last transition is older than this go. */
export function closedPurgeCutoff(now = new Date(), days = CLOSED_PURGE_DAYS): Date {
	return new Date(now.getTime() - days * 86_400_000);
}

/**
 * "Delete closed feedback older than CLOSED_PURGE_DAYS", on an admin's click. The storage
 * bound for closed and anonymous rows without a scheduled job. Duplicates that pointed at a
 * purged row keep their close reason; their target goes null (FK SET NULL).
 */
export async function purgeClosedFeedback(actor: FeedbackActor, now = new Date()): Promise<{ deleted: number }> {
	const cutoff = closedPurgeCutoff(now);
	return db.transaction(async (tx) => {
		const deleted = await tx
			.delete(feedback)
			.where(and(eq(feedback.status, 'closed'), lt(feedback.statusChangedAt, cutoff)))
			.returning({ id: feedback.id });
		if (deleted.length > 0) {
			await recordAuditEvent(
				{
					actorId: actor.actorId,
					actorEmail: actor.actorEmail,
					action: 'feedback.purge',
					targetType: 'feedback.feedback',
					detail: { deleted: deleted.length, cutoff: cutoff.toISOString() },
					ipAddress: actor.ipAddress,
				},
				tx,
			);
		}
		return { deleted: deleted.length };
	});
}
