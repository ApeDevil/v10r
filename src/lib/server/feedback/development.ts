/**
 * The feedback lifecycle's development half (Slice 2): Gate 1 (development approval), the
 * implementation report, Gate 2 (release approval), rework, return for analysis and the
 * release confirmation. Same discipline as triage: each is one transaction that locks the
 * item, checks its state, writes the item, its development record and one audit row
 * together. Audit details carry ids, states, branches and SHAs only.
 *
 * Nothing here calls out: no GitHub, no coding agent, no deployment, no database migration.
 * The two gates record decisions; the maintainer's own message in a coding session is what
 * starts work or ships (§5, §6 of docs/blueprint/feedback/request-driven-development.md).
 */
import { eq, inArray } from 'drizzle-orm';
import type { FeedbackStatus } from '#lib/feedback/status.ts';
import { recordAuditEvent } from '#lib/server/admin/index.ts';
import { type DbHandle, db } from '#lib/server/db/index.ts';
import { ACTIVE_DEVELOPMENT_STATUSES, development, feedback } from '#lib/server/db/schema/feedback/index.ts';
import {
	type ImplementationReport,
	type ImplementationReportRefusal,
	parseImplementationReport,
} from './implementation-report';
import type { FeedbackActor } from './lifecycle';
import { parseShippingReceipt, type ShippingReceipt, type ShippingReceiptRefusal } from './shipping-receipt';

export const DEVELOPMENT_AGENTS = ['claude', 'codex'] as const;
export type DevelopmentAgent = (typeof DEVELOPMENT_AGENTS)[number];

export const SCOPE_MAX_CHARS = 8000;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;

/**
 * `claude/cloud/feedback-<last 6 of the id>-<slug>`: the repo's `<agent>/<env>/<feature>`.
 * From the second development attempt on, `-a<attempt>` follows, so an attempt returned for
 * analysis never shares a branch, a report or a receipt with the next one.
 */
export function developmentBranch(feedbackId: string, agent: DevelopmentAgent, slug: string, attempt = 1): string {
	const suffix = attempt > 1 ? `-a${attempt}` : '';
	return `${agent}/cloud/feedback-${feedbackId.replace(/^fbk_/, '').slice(-6)}-${slug}${suffix}`;
}

export type DevelopmentRefusal =
	| { refusal: 'not_found' }
	| { refusal: 'invalid_transition'; current: FeedbackStatus }
	/** Another item holds the single development slot. */
	| { refusal: 'slot_taken'; activeId: string | null }
	| { refusal: 'invalid_scope' }
	| { refusal: 'invalid_branch' }
	/** The branch name is already taken by another item's development record. */
	| { refusal: 'branch_taken' }
	| { refusal: 'report_rejected'; reason: ImplementationReportRefusal; issues?: string[] }
	/** The page approved a SHA that is no longer the reported one: reload and review again. */
	| { refusal: 'stale_review'; reportedSha: string | null }
	/** The report itself rules the release out: rework or return it, don't release it. */
	| { refusal: 'not_releasable'; blockers: ReleaseBlocker[] }
	| { refusal: 'receipt_rejected'; reason: ShippingReceiptRefusal; issues?: string[] }
	/** The running deployment is not the ship commit, and the maintainer did not confirm. */
	| { refusal: 'needs_maintainer_confirmation'; runningSha: string | null };

export type DevelopmentResult =
	| { ok: true; from: FeedbackStatus; to: FeedbackStatus }
	| ({ ok: false } & DevelopmentRefusal);

const UNIQUE_VIOLATION = '23505';

function uniqueViolation(err: unknown): string | null {
	// Drizzle wraps the driver error; the SQLSTATE and constraint sit on the cause. node-postgres
	// and Neon carry the SQLSTATE as `code`, Bun's SQL driver (the real-PG race checks) as `errno`.
	for (let e: unknown = err; e && typeof e === 'object'; e = (e as { cause?: unknown }).cause) {
		const { code, errno, constraint } = e as { code?: string; errno?: string; constraint?: string };
		if (code === UNIQUE_VIOLATION || errno === UNIQUE_VIOLATION) return constraint ?? '';
	}
	return null;
}

async function lockItem(handle: DbHandle, id: string) {
	const [row] = await handle
		.select({ id: feedback.id, status: feedback.status, developmentAttempts: feedback.developmentAttempts })
		.from(feedback)
		.where(eq(feedback.id, id))
		.for('update');
	return row ?? null;
}

async function lockDevelopment(handle: DbHandle, id: string) {
	const [row] = await handle.select().from(development).where(eq(development.feedbackId, id)).for('update');
	return row ?? null;
}

/** The item currently holding the development slot, if any. */
export async function getActiveDevelopmentId(handle: DbHandle = db): Promise<string | null> {
	const [row] = await handle
		.select({ id: feedback.id })
		.from(feedback)
		.where(inArray(feedback.status, [...ACTIVE_DEVELOPMENT_STATUSES]))
		.limit(1);
	return row?.id ?? null;
}

async function audit(
	handle: DbHandle,
	actor: FeedbackActor,
	id: string,
	action: string,
	detail: Record<string, unknown>,
) {
	await recordAuditEvent(
		{
			actorId: actor.actorId,
			actorEmail: actor.actorEmail,
			action: `feedback.${action}`,
			targetType: 'feedback.feedback',
			targetId: id,
			detail,
			ipAddress: actor.ipAddress,
		},
		handle,
	);
}

/** A refusal thrown out of a transaction so it rolls back, then returned as a result. */
class Refused extends Error {
	constructor(readonly result: { ok: false } & DevelopmentRefusal) {
		super(result.refusal);
	}
}

async function run(work: (tx: DbHandle) => Promise<DevelopmentResult>): Promise<DevelopmentResult> {
	try {
		return await db.transaction(work);
	} catch (err) {
		if (err instanceof Refused) return err.result;
		throw err;
	}
}

// ── Gate 1 ────────────────────────────────────────────────────────────────────

export interface ApproveDevelopmentInput {
	scope: string;
	agent: DevelopmentAgent;
	slug: string;
	includeSubmitterText: boolean;
}

/**
 * accepted → in_development. Takes the single development slot (the partial unique index
 * decides a race), creates the development record and audits, all or nothing.
 */
export async function approveDevelopment(
	id: string,
	input: ApproveDevelopmentInput,
	actor: FeedbackActor,
): Promise<DevelopmentResult> {
	const scope = input.scope.trim();
	if (scope.length === 0 || scope.length > SCOPE_MAX_CHARS) return { ok: false, refusal: 'invalid_scope' };
	if (!SLUG_PATTERN.test(input.slug) || !(DEVELOPMENT_AGENTS as readonly string[]).includes(input.agent)) {
		return { ok: false, refusal: 'invalid_branch' };
	}
	const result = await run(async (tx) => {
		const row = await lockItem(tx, id);
		if (!row) return { ok: false, refusal: 'not_found' };
		if (row.status !== 'accepted') return { ok: false, refusal: 'invalid_transition', current: row.status };
		// A new attempt every time: the item row is locked, so the count cannot race.
		const attempt = row.developmentAttempts + 1;
		const branch = developmentBranch(id, input.agent, input.slug, attempt);
		try {
			await tx
				.update(feedback)
				.set({ status: 'in_development', statusChangedAt: new Date(), developmentAttempts: attempt })
				.where(eq(feedback.id, id));
			await tx.insert(development).values({
				feedbackId: id,
				branch,
				attempt,
				scope,
				includeSubmitterText: input.includeSubmitterText,
				approvedBy: actor.actorId,
			});
		} catch (err) {
			// The index or the branch's uniqueness decided a race: roll everything back.
			const constraint = uniqueViolation(err);
			if (constraint === 'feedback_one_active_development_idx') {
				throw new Refused({ ok: false, refusal: 'slot_taken', activeId: null });
			}
			if (constraint === 'development_branch_idx') throw new Refused({ ok: false, refusal: 'branch_taken' });
			throw err;
		}
		await audit(tx, actor, id, 'approve_development', {
			from: 'accepted',
			to: 'in_development',
			branch,
			attempt,
			includeSubmitterText: input.includeSubmitterText,
		});
		return { ok: true, from: 'accepted', to: 'in_development' };
	});
	if (!result.ok && result.refusal === 'slot_taken') return { ...result, activeId: await getActiveDevelopmentId() };
	return result;
}

// ── The implementation report ─────────────────────────────────────────────────

const REPORTABLE: readonly FeedbackStatus[] = ['in_development', 'ready_for_review', 'release_approved'];

/**
 * Import a pasted agent report → ready_for_review. A new report always replaces the old one
 * and clears any release approval: a changed implementation must be approved again.
 */
export async function recordImplementationReport(
	id: string,
	paste: string,
	actor: FeedbackActor,
): Promise<DevelopmentResult> {
	return run(async (tx) => {
		const row = await lockItem(tx, id);
		if (!row) return { ok: false, refusal: 'not_found' };
		if (!REPORTABLE.includes(row.status)) return { ok: false, refusal: 'invalid_transition', current: row.status };
		const record = await lockDevelopment(tx, id);
		if (!record) return { ok: false, refusal: 'not_found' };

		const parsed = parseImplementationReport(paste, { feedbackId: id, branch: record.branch });
		if (!parsed.ok) return { ok: false, refusal: 'report_rejected', reason: parsed.refusal, issues: parsed.issues };

		await tx
			.update(development)
			.set({
				reportedSha: parsed.report.headSha,
				report: parsed.report,
				reportedAt: new Date(),
				reportRevision: record.reportRevision + 1,
				releaseApprovedSha: null,
				releaseApprovedBy: null,
				releaseApprovedAt: null,
				withdrawnReleaseSha: record.releaseApprovedSha ?? record.withdrawnReleaseSha,
			})
			.where(eq(development.feedbackId, id));
		if (row.status !== 'ready_for_review') {
			await tx
				.update(feedback)
				.set({ status: 'ready_for_review', statusChangedAt: new Date() })
				.where(eq(feedback.id, id));
		}
		await audit(tx, actor, id, 'record_report', {
			from: row.status,
			to: 'ready_for_review',
			branch: record.branch,
			sha: parsed.report.headSha,
			revision: record.reportRevision + 1,
			replacedSha: record.reportedSha,
			invalidatedReleaseSha: record.releaseApprovedSha,
			recommendation: parsed.report.recommendation,
		});
		return { ok: true, from: row.status, to: 'ready_for_review' };
	});
}

// ── Gate 2 ────────────────────────────────────────────────────────────────────

export const RELEASE_BLOCKERS = [
	'validate_not_passed',
	'validate_build_not_passed',
	'browser_not_passed',
	'scope_exceeded',
	'needs_decision',
	'not_recommended',
] as const;
export type ReleaseBlocker = (typeof RELEASE_BLOCKERS)[number];

/**
 * What in a report rules a normal release out. The report's results are the agent's claims;
 * passing here only means it does not argue against release. The ship gate re-runs validate
 * and validate:build on the exact commit either way.
 */
export function releaseBlockers(report: ImplementationReport): ReleaseBlocker[] {
	const blockers: ReleaseBlocker[] = [];
	if (report.validation.validate !== 'passed') blockers.push('validate_not_passed');
	if (report.validation.validateBuild !== 'passed') blockers.push('validate_build_not_passed');
	if (report.validation.browser !== 'passed' && report.validation.browser !== 'not_applicable') {
		blockers.push('browser_not_passed');
	}
	if (report.scopeExceeded) blockers.push('scope_exceeded');
	if (report.recommendation === 'needs_decision') blockers.push('needs_decision');
	if (report.recommendation === 'do_not_release') blockers.push('not_recommended');
	return blockers;
}

/** What the admin's page showed: the commit and the exact report revision. */
export interface ReviewedReport {
	sha: string;
	revision: number;
}

/**
 * ready_for_review → release_approved, for exactly the reviewed commit AND report revision.
 * If a newer report replaced the one on the admin's page, even with the same SHA, the approval
 * is refused (stale review). A report that rules a release out is refused too.
 */
export async function approveRelease(
	id: string,
	reviewed: ReviewedReport,
	actor: FeedbackActor,
): Promise<DevelopmentResult> {
	return run(async (tx) => {
		const row = await lockItem(tx, id);
		if (!row) return { ok: false, refusal: 'not_found' };
		if (row.status !== 'ready_for_review') return { ok: false, refusal: 'invalid_transition', current: row.status };
		const record = await lockDevelopment(tx, id);
		if (!record?.reportedSha || !record.report) return { ok: false, refusal: 'stale_review', reportedSha: null };
		if (record.reportedSha !== reviewed.sha || record.reportRevision !== reviewed.revision) {
			return { ok: false, refusal: 'stale_review', reportedSha: record.reportedSha };
		}
		const blockers = releaseBlockers(record.report as ImplementationReport);
		if (blockers.length > 0) return { ok: false, refusal: 'not_releasable', blockers };
		await tx
			.update(development)
			.set({
				releaseApprovedSha: record.reportedSha,
				releaseApprovedBy: actor.actorId,
				releaseApprovedAt: new Date(),
				withdrawnReleaseSha: null,
			})
			.where(eq(development.feedbackId, id));
		await tx
			.update(feedback)
			.set({ status: 'release_approved', statusChangedAt: new Date() })
			.where(eq(feedback.id, id));
		await audit(tx, actor, id, 'approve_release', {
			from: 'ready_for_review',
			to: 'release_approved',
			branch: record.branch,
			sha: record.reportedSha,
			revision: record.reportRevision,
		});
		return { ok: true, from: 'ready_for_review', to: 'release_approved' };
	});
}

/**
 * ready_for_review | release_approved → in_development: the implementation needs more work.
 * Clears the report and any release approval; a new report and a new approval are needed.
 */
export async function requestRework(id: string, actor: FeedbackActor): Promise<DevelopmentResult> {
	return run(async (tx) => {
		const row = await lockItem(tx, id);
		if (!row) return { ok: false, refusal: 'not_found' };
		if (row.status !== 'ready_for_review' && row.status !== 'release_approved') {
			return { ok: false, refusal: 'invalid_transition', current: row.status };
		}
		const record = await lockDevelopment(tx, id);
		await tx
			.update(development)
			.set({
				reportedSha: null,
				report: null,
				reportedAt: null,
				releaseApprovedSha: null,
				releaseApprovedBy: null,
				releaseApprovedAt: null,
				withdrawnReleaseSha: record?.releaseApprovedSha ?? record?.withdrawnReleaseSha ?? null,
			})
			.where(eq(development.feedbackId, id));
		await tx.update(feedback).set({ status: 'in_development', statusChangedAt: new Date() }).where(eq(feedback.id, id));
		await audit(tx, actor, id, 'request_rework', {
			from: row.status,
			to: 'in_development',
			branch: record?.branch ?? null,
			clearedSha: record?.reportedSha ?? null,
			invalidatedReleaseSha: record?.releaseApprovedSha ?? null,
		});
		return { ok: true, from: row.status, to: 'in_development' };
	});
}

/**
 * Any active development state → accepted: abandon the attempt and return the item to
 * triage. Frees the development slot and removes the development record (the audit row
 * keeps its branch and SHAs). The branch itself is left alone; deleting it is the
 * maintainer's call. The item keeps its attempt count, so the next Gate 1 opens a new attempt
 * on a new branch name, and reports or receipts naming the old branch are refused.
 */
export async function returnForAnalysis(id: string, actor: FeedbackActor): Promise<DevelopmentResult> {
	return run(async (tx) => {
		const row = await lockItem(tx, id);
		if (!row) return { ok: false, refusal: 'not_found' };
		if (row.status !== 'in_development' && row.status !== 'ready_for_review' && row.status !== 'release_approved') {
			return { ok: false, refusal: 'invalid_transition', current: row.status };
		}
		const record = await lockDevelopment(tx, id);
		await tx.delete(development).where(eq(development.feedbackId, id));
		await tx.update(feedback).set({ status: 'accepted', statusChangedAt: new Date() }).where(eq(feedback.id, id));
		await audit(tx, actor, id, 'return_for_analysis', {
			from: row.status,
			to: 'accepted',
			branch: record?.branch ?? null,
			attempt: record?.attempt ?? null,
			reportedSha: record?.reportedSha ?? null,
			releaseApprovedSha: record?.releaseApprovedSha ?? null,
		});
		return { ok: true, from: row.status, to: 'accepted' };
	});
}

// ── Release confirmation ──────────────────────────────────────────────────────

export interface ConfirmReleaseInput {
	receipt: string;
	/** The deployment answering this request (`VERCEL_GIT_COMMIT_SHA`), or null off Vercel. */
	runningSha: string | null;
	/** The maintainer's explicit "the shipping evidence shows it went out". */
	maintainerConfirmed: boolean;
}

/**
 * release_approved → released, on a pasted shipping receipt that matches the approved
 * implementation and records a passed gate, a synced GitLab and a READY deployment.
 *
 * If this request is served by the ship commit itself, the release is confirmed against
 * the live version. Otherwise (not live yet, or a later deployment already superseded it)
 * a SHA mismatch proves nothing either way, so it takes the maintainer's explicit
 * confirmation, and the record says which of the two it was.
 */
export async function confirmRelease(
	id: string,
	input: ConfirmReleaseInput,
	actor: FeedbackActor,
): Promise<DevelopmentResult> {
	return run(async (tx) => {
		const row = await lockItem(tx, id);
		if (!row) return { ok: false, refusal: 'not_found' };
		if (row.status !== 'release_approved') return { ok: false, refusal: 'invalid_transition', current: row.status };
		const record = await lockDevelopment(tx, id);
		if (!record?.releaseApprovedSha) return { ok: false, refusal: 'invalid_transition', current: row.status };

		const parsed = parseShippingReceipt(input.receipt, {
			feedbackId: id,
			branch: record.branch,
			approvedSha: record.releaseApprovedSha,
		});
		if (!parsed.ok) return { ok: false, refusal: 'receipt_rejected', reason: parsed.refusal, issues: parsed.issues };

		const live = input.runningSha !== null && input.runningSha === parsed.receipt.shipCommit;
		if (!live && !input.maintainerConfirmed) {
			return { ok: false, refusal: 'needs_maintainer_confirmation', runningSha: input.runningSha };
		}
		const verification = live ? ('live_version' as const) : ('maintainer' as const);

		await tx
			.update(development)
			.set({
				releasedSha: parsed.receipt.shipCommit,
				releasedAt: new Date(),
				releaseVerification: verification,
				runningShaAtRelease: input.runningSha,
				receipt: parsed.receipt,
			})
			.where(eq(development.feedbackId, id));
		await tx.update(feedback).set({ status: 'released', statusChangedAt: new Date() }).where(eq(feedback.id, id));
		await audit(tx, actor, id, 'confirm_release', {
			from: 'release_approved',
			to: 'released',
			branch: record.branch,
			sha: record.releaseApprovedSha,
			shipCommit: parsed.receipt.shipCommit,
			verification,
			runningSha: input.runningSha,
		});
		return { ok: true, from: 'release_approved', to: 'released' };
	});
}

export async function getDevelopment(id: string) {
	const [row] = await db.select().from(development).where(eq(development.feedbackId, id));
	if (!row) return null;
	// Both were validated against their schemas before they were stored.
	return {
		...row,
		report: row.report as ImplementationReport | null,
		receipt: row.receipt as ShippingReceipt | null,
	};
}
