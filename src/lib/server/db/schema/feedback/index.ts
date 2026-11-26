/**
 * FEEDBACK — what visitors and users send from /feedback, and its place in the
 * feedback lifecycle (docs/blueprint/feedback/request-driven-development.md).
 *
 * Linked to an analytics session only when the submitter attached technical context AND
 * analytics consent set the session cookie; otherwise sessionId is null. Linked to an
 * account when the submitter was signed in. Never auto-expires: closed rows are purged on
 * demand from the admin inbox (`purgeClosedFeedback`).
 */
import { sql } from 'drizzle-orm';
import {
	type AnyPgColumn,
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgSchema,
	smallint,
	text,
	timestamp,
	uniqueIndex,
} from 'drizzle-orm/pg-core';
import { FEEDBACK_CATEGORIES } from '../../../../feedback/category';
import { FEEDBACK_CLOSE_REASONS, FEEDBACK_STATUSES, type FeedbackStatus } from '../../../../feedback/status';
import { user } from '../auth/_better-auth';

export const feedbackSchema = pgSchema('feedback');

export const feedbackCategoryEnum = feedbackSchema.enum('feedback_category', FEEDBACK_CATEGORIES);

/**
 * The lifecycle. Triage states first, then the development states Slice 2 drives, then the
 * one terminal state that carries its reason in `close_reason`.
 */
export const feedbackStatusEnum = feedbackSchema.enum('feedback_status', FEEDBACK_STATUSES);

export const feedbackCloseReasonEnum = feedbackSchema.enum('feedback_close_reason', FEEDBACK_CLOSE_REASONS);

/**
 * The states that hold the single development slot. The partial unique index below is the
 * rule; this list is its one spelling in code.
 */
export const ACTIVE_DEVELOPMENT_STATUSES = [
	'in_development',
	'ready_for_review',
	'release_approved',
] as const satisfies readonly FeedbackStatus[];

/**
 * The states whose row carries engineering state that outlives its submitter: account
 * erasure blanks their personal columns instead of deleting them, and an admin delete is
 * refused. Everything else is the submitter's alone and goes with the account.
 */
export const ENGINEERING_STATUSES = [
	...ACTIVE_DEVELOPMENT_STATUSES,
	'released',
] as const satisfies readonly FeedbackStatus[];

export const feedback = feedbackSchema.table(
	'feedback',
	{
		id: text('id').primaryKey(),
		category: feedbackCategoryEnum('category').notNull().default('general'),
		subject: text('subject').notNull(),
		body: text('body').notNull(),
		rating: smallint('rating'),
		contactEmail: text('contact_email'),
		/** The submitting account. Cascade is the erasure for every row outside
		 * ENGINEERING_STATUSES; those are unlinked first (privacy/mutations.ts). */
		userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
		/** '' = "no source". DB default matches the app-layer default so future
		 * insert paths don't have to reproduce the valibot behavior. */
		pageOfOrigin: text('page_of_origin').notNull().default(''),
		/** Technical context, stored only when the submitter ticked it. `route_id` is the
		 * SvelteKit route pattern (`/blog/[slug]`) — no parameter values by construction. */
		routeId: text('route_id'),
		/** The deployment's commit at submit time, filled server-side. */
		appVersion: text('app_version'),
		/** The `handleError` id a 5xx page linked here with. */
		errorId: text('error_id'),
		sessionId: text('session_id'),
		status: feedbackStatusEnum('status').notNull().default('received'),
		closeReason: feedbackCloseReasonEnum('close_reason'),
		/** SET NULL: a duplicate whose original was erased stays closed as a duplicate. */
		duplicateOf: text('duplicate_of').references((): AnyPgColumn => feedback.id, { onDelete: 'set null' }),
		/** The admin's working note. Never shown to the submitter, never exported. */
		triageNote: text('triage_note'),
		submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
		statusChangedAt: timestamp('status_changed_at', { withTimezone: true }).notNull().defaultNow(),
		/** Set when the submitter's account was erased while the row held engineering state. */
		erasedAt: timestamp('erased_at', { withTimezone: true }),
		/** How many times Gate 1 approved this item. Each approval is a new development attempt
		 * with its own branch name, so a returned attempt's branch and report are never reused. */
		developmentAttempts: integer('development_attempts').notNull().default(0),
		nonce: text('nonce').notNull(),
	},
	(table) => [
		uniqueIndex('feedback_nonce_idx').on(table.nonce),
		index('feedback_status_submitted_idx').on(table.status, table.submittedAt),
		index('feedback_submitted_idx').on(table.submittedAt),
		index('feedback_user_submitted_idx').on(table.userId, table.submittedAt),
		// "Does this item have duplicates?" and the FK's SET NULL when an original is deleted.
		index('feedback_duplicate_of_idx').on(table.duplicateOf),
		// The single development slot: at most one row in an active development state,
		// whoever or whatever tries. Constant key, so any two such rows collide. The literal list
		// is ACTIVE_DEVELOPMENT_STATUSES; feedback.pglite.test.ts fails if the two drift.
		uniqueIndex('feedback_one_active_development_idx')
			.on(sql`(true)`)
			.where(sql`${table.status} IN ('in_development', 'ready_for_review', 'release_approved')`),
		check('feedback_rating_range', sql`${table.rating} IS NULL OR (${table.rating} BETWEEN 1 AND 5)`),
		// LOAD-BEARING backstops for the valibot limits: a future bulk-import or admin edit
		// path bypassing the form schema cannot write unbounded text. Same doctrine as
		// mcp.call_log.
		check('feedback_subject_len', sql`char_length(${table.subject}) <= 120`),
		check('feedback_body_len', sql`char_length(${table.body}) <= 4000`),
		check('feedback_source_len', sql`char_length(${table.pageOfOrigin}) <= 512`),
		check('feedback_route_len', sql`char_length(${table.routeId}) <= 200`),
		check('feedback_version_len', sql`char_length(${table.appVersion}) <= 64`),
		check('feedback_error_id_shape', sql`${table.errorId} ~ '^[A-Za-z0-9_-]{1,64}$'`),
		check('feedback_note_len', sql`char_length(${table.triageNote}) <= 2000`),
		// A closed row always says why; an open row never carries a reason.
		check('feedback_close_reason_iff_closed', sql`(${table.status} = 'closed') = (${table.closeReason} IS NOT NULL)`),
		// One direction only: a target implies "duplicate", but a duplicate whose target was
		// erased (SET NULL) stays a valid closed duplicate.
		check('feedback_duplicate_target_reason', sql`${table.duplicateOf} IS NULL OR ${table.closeReason} = 'duplicate'`),
		check('feedback_not_own_duplicate', sql`${table.duplicateOf} IS NULL OR ${table.duplicateOf} <> ${table.id}`),
		check('feedback_development_attempts_range', sql`${table.developmentAttempts} >= 0`),
	],
);

/** How a release was confirmed: the live version matched, or the maintainer confirmed it. */
export const feedbackReleaseVerificationEnum = feedbackSchema.enum('feedback_release_verification', [
	'live_version',
	'maintainer',
]);

/**
 * DEVELOPMENT — the engineering record of one feedback item from Gate 1 on: the branch, the
 * admin's scope, the reported implementation, the release approval and the release. One row
 * per item, created by `approveDevelopment` in the same transaction that takes the
 * development slot; removed with the item's return to triage. Written by the admin and the
 * agent, never by the submitter, so it survives the submitter's erasure intact.
 */
export const development = feedbackSchema.table(
	'development',
	{
		feedbackId: text('feedback_id')
			.primaryKey()
			.references(() => feedback.id, { onDelete: 'cascade' }),
		branch: text('branch').notNull(),
		/** Which Gate 1 approval of the item this is (1-based); part of the branch name from 2 on. */
		attempt: integer('attempt').notNull(),
		/** The admin's words: the only instruction the brief gives. */
		scope: text('scope').notNull(),
		/** Whether the brief quotes the submission (as untrusted data). Off by default; cleared on erasure. */
		includeSubmitterText: boolean('include_submitter_text').notNull().default(false),
		approvedBy: text('approved_by').notNull(),
		approvedAt: timestamp('approved_at', { withTimezone: true }).notNull().defaultNow(),
		/** The implementation as reported: the agent's claim, validated in shape only. */
		reportedSha: text('reported_sha'),
		// Typed by the feedback domain (`ImplementationReport`); the schema stays domain-free.
		report: jsonb('report').$type<Record<string, unknown>>(),
		reportedAt: timestamp('reported_at', { withTimezone: true }),
		/** Bumped by every recorded report: Gate 2 approves this exact revision, not just its SHA. */
		reportRevision: integer('report_revision').notNull().default(0),
		/** Gate 2: binds exactly the reviewed commit. */
		releaseApprovedSha: text('release_approved_sha'),
		releaseApprovedBy: text('release_approved_by'),
		releaseApprovedAt: timestamp('release_approved_at', { withTimezone: true }),
		/** The last release approval a new report or rework withdrew: its handoff is no longer authorized. */
		withdrawnReleaseSha: text('withdrawn_release_sha'),
		releasedSha: text('released_sha'),
		releasedAt: timestamp('released_at', { withTimezone: true }),
		releaseVerification: feedbackReleaseVerificationEnum('release_verification'),
		/** The running deployment's commit when the release was confirmed. */
		runningShaAtRelease: text('running_sha_at_release'),
		receipt: jsonb('receipt').$type<Record<string, unknown>>(),
	},
	(table) => [
		uniqueIndex('development_branch_idx').on(table.branch),
		check('development_branch_shape', sql`${table.branch} ~ '^[a-z]+/[a-z]+/[a-z0-9][a-z0-9-]{0,79}$'`),
		check('development_scope_len', sql`char_length(${table.scope}) BETWEEN 1 AND 8000`),
		check('development_reported_sha_shape', sql`${table.reportedSha} ~ '^[0-9a-f]{40}$'`),
		check('development_release_sha_shape', sql`${table.releaseApprovedSha} ~ '^[0-9a-f]{40}$'`),
		check('development_released_sha_shape', sql`${table.releasedSha} ~ '^[0-9a-f]{40}$'`),
		check('development_withdrawn_sha_shape', sql`${table.withdrawnReleaseSha} ~ '^[0-9a-f]{40}$'`),
		check('development_attempt_range', sql`${table.attempt} >= 1`),
		check('development_report_revision_range', sql`${table.reportRevision} >= 0`),
		check('development_report_size', sql`octet_length(${table.report}::text) <= 32000`),
		check('development_receipt_size', sql`octet_length(${table.receipt}::text) <= 4000`),
		// A report is all three fields or none.
		check(
			'development_report_complete',
			sql`(${table.reportedSha} IS NULL) = (${table.report} IS NULL) AND (${table.report} IS NULL) = (${table.reportedAt} IS NULL)`,
		),
		// Gate 2 approves exactly the reported commit; rework clears it with the report.
		check(
			'development_release_binds_report',
			// Spelled out: a bare `=` against a NULL report is NULL, and a NULL CHECK passes.
			sql`${table.releaseApprovedSha} IS NULL OR (${table.reportedSha} IS NOT NULL AND ${table.releaseApprovedSha} = ${table.reportedSha})`,
		),
		check(
			'development_released_after_approval',
			sql`${table.releasedSha} IS NULL OR ${table.releaseApprovedSha} IS NOT NULL`,
		),
	],
);
