/**
 * Proposal lifecycle mutations.
 *
 * State machine: `pending → approved → executing → executed | failed`
 *                `       ↓         ↓              `
 *                `    rejected   (retry = new row)`
 *
 * Exactly-once execution comes from `markExecuting`'s conditional UPDATE
 * (`approved → executing` matches one caller; a concurrent one gets no row and reads
 * the existing one instead of racing). What each step did is the
 * `agent_proposal_step` receipt, written in the step's own transaction, which also
 * holds the fence (`lockExecuting`): a run healed to `failed('interrupted')` cannot
 * commit another step. Lease time is the DATABASE clock throughout.
 */
import { and, asc, eq, gt, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { ProposalStepKind } from '$lib/types/db-enums';
import { createId } from '../id';
import { type DbHandle, db } from '../index';
import { conversation } from '../schema/ai/conversation';
import { agentProposal, type ProposedToolCall } from '../schema/ai/proposal';
import { agentProposalRevertStep, agentProposalStep, type StepRecoveryPoint } from '../schema/ai/proposal-step';

/**
 * The time bound on consent, as a SQL predicate.
 *
 * Deliberately `now()` — Postgres's clock — and not a JS `new Date()` bound
 * param. `status` is evaluated by the database, so the expiry that grants or
 * denies authority alongside it must be read from the same clock; a serverless
 * function's `Date.now()` is a second, skewable opinion. (`createdAt` /
 * `updatedAt` on this table are already `.defaultNow()`, so `expiresAt` was the
 * odd column out.) Note this is an architectural argument, not a tested one:
 * the PGlite test DB runs in-process and shares the host clock, so no test here
 * can tell the two apart. The shape test in `proposals.pglite.test.ts` pins the intent.
 */
const notExpired = () => gt(agentProposal.expiresAt, sql`now()`);

const DEFAULT_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes — stale proposals auto-expire

/**
 * How long an `executing` row may go without a heartbeat before it is presumed dead.
 * The lease is PER STEP, not per run: `executeProposal` touches the row after every step,
 * so a live run is never mis-marked unless one step stalls this long, and a marked run is
 * never re-run — `markInterruptedIfStale` heals lazily on the next read, and the receipts
 * say which steps committed. Twice the approve route's declared 60 s ceiling (its
 * `config.maxDuration`): no step can be silent that long and still be running.
 */
export const EXECUTION_LEASE_MS = 120_000;

export interface CreateProposalInput {
	conversationId: string;
	messageId: string;
	riskTier?: 'low' | 'medium' | 'high';
	payload: ProposedToolCall[];
	rationale?: string;
	/**
	 * Scopes in force when the plan was proposed. Frozen here so approval cannot
	 * be replayed under a wider grant than the user reviewed.
	 */
	grantedScopes?: string[];
	/** Override the default 15-minute expiry. */
	expiresInMs?: number;
}

/** Create a new `pending` proposal. */
export async function createProposal(input: CreateProposalInput) {
	const now = Date.now();
	const [row] = await db
		.insert(agentProposal)
		.values({
			id: createId.agentProposal(),
			conversationId: input.conversationId,
			messageId: input.messageId,
			status: 'pending',
			riskTier: input.riskTier ?? 'medium',
			payload: input.payload,
			grantedScopes: input.grantedScopes ?? [],
			rationale: input.rationale ?? '',
			expiresAt: new Date(now + (input.expiresInMs ?? DEFAULT_EXPIRY_MS)),
		})
		.returning();
	return row;
}

/** Fetch a proposal by id. Returns `null` if not found. */
export async function getProposal(id: string) {
	const [row] = await db.select().from(agentProposal).where(eq(agentProposal.id, id)).limit(1);
	return row ?? null;
}

/**
 * Read a proposal back with the database's own verdict on whether it has expired.
 *
 * Diagnostic ONLY. A failed conditional UPDATE returns zero rows without saying
 * which conjunct failed — status moved on, or the clock ran out — and the caller
 * needs to tell those apart to pick an error code. It grants no authority: the
 * real decision was already made atomically by the UPDATE predicate, so the fact
 * that this SELECT can observe a state that has since moved on again only ever
 * changes which message the client reads, never whether anything executed.
 *
 * `isExpired` is computed in SQL for the same reason `notExpired` is: reading
 * `expiresAt` back into JS and comparing it there would reintroduce the app
 * clock the predicate just took care to avoid.
 */
export async function getProposalWithExpiry(id: string) {
	const [row] = await db
		.select({ proposal: agentProposal, isExpired: sql<boolean>`${agentProposal.expiresAt} <= now()` })
		.from(agentProposal)
		.where(eq(agentProposal.id, id))
		.limit(1);
	return row ?? null;
}

/**
 * Flip an expired `pending` row to `expired` so the state machine self-heals at
 * the moment someone actually touches it, rather than waiting on a sweep.
 *
 * Races harmlessly: it gates on `status = 'pending'` like every other transition
 * here, so Postgres serialises the row write and a concurrent approve/reject
 * simply matches zero rows. Hygiene only — `approveProposal` and `markExecuting`
 * already refuse expired rows on their own, so correctness never depends on this
 * running.
 */
export async function markExpiredIfPending(id: string) {
	const [row] = await db
		.update(agentProposal)
		.set({ status: 'expired', updatedAt: new Date() })
		.where(and(eq(agentProposal.id, id), eq(agentProposal.status, 'pending'), sql`${agentProposal.expiresAt} <= now()`))
		.returning();
	return row ?? null;
}

/**
 * Transition `pending → approved`. Returns the updated row, or null if the
 * transition was illegal — either the status moved on, or the proposal expired.
 *
 * The expiry check lives in this predicate rather than in the calling route on
 * purpose: a read-then-act check in the route is a TOCTOU window, and it leaves
 * this function callable without a time bound from anywhere else. The statement
 * that grants authority is the statement that must enforce every condition on it.
 */
export async function approveProposal(id: string, approvedByUserId: string) {
	const [row] = await db
		.update(agentProposal)
		.set({
			status: 'approved',
			approvedBy: approvedByUserId,
			approvedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(and(eq(agentProposal.id, id), eq(agentProposal.status, 'pending'), notExpired()))
		.returning();
	return row ?? null;
}

/** Transition `pending → rejected`. */
export async function rejectProposal(id: string, reason?: string) {
	const [row] = await db
		.update(agentProposal)
		.set({
			status: 'rejected',
			rejectedReason: reason ?? null,
			updatedAt: new Date(),
		})
		.where(and(eq(agentProposal.id, id), eq(agentProposal.status, 'pending')))
		.returning();
	return row ?? null;
}

/**
 * Transition `approved → executing`.
 *
 * Protected by the partial unique index on `agent_proposal` — a
 * concurrent call finds the existing `executing` / `executed` row and
 * this UPDATE matches zero rows. Callers detect the zero-row result,
 * read the existing row, and return its cached state.
 *
 * Returns the updated row on success, or `null` if the transition was
 * illegal (e.g. proposal already executing, rejected, or expired).
 *
 * Carries the same expiry bound as `approveProposal`, and needs to: these are
 * two separate statements, so a proposal approved one minute before expiry and
 * executed twenty minutes later would otherwise run unbounded.
 */
export async function markExecuting(id: string) {
	const [row] = await db
		.update(agentProposal)
		.set({ status: 'executing', updatedAt: sql`now()` })
		.where(and(eq(agentProposal.id, id), eq(agentProposal.status, 'approved'), notExpired()))
		.returning();
	return row ?? null;
}

/** Transition `executing → executed`. The per-step record is already in `agent_proposal_step`. */
export async function markExecuted(id: string) {
	const now = new Date();
	const [row] = await db
		.update(agentProposal)
		.set({ status: 'executed', executedAt: now, updatedAt: now })
		.where(and(eq(agentProposal.id, id), eq(agentProposal.status, 'executing')))
		.returning();
	return row ?? null;
}

/**
 * Transition `executing → failed`. The steps that did run keep their receipts (the
 * replay is sequential with no rollback — earlier mutations stick); `message` names
 * why the plan stopped: the failing step's error, `'conflict'`, or `'interrupted'`.
 */
export async function markFailed(id: string, message: string) {
	const [row] = await db
		.update(agentProposal)
		.set({ status: 'failed', failureMessage: message, updatedAt: new Date() })
		.where(and(eq(agentProposal.id, id), eq(agentProposal.status, 'executing')))
		.returning();
	return row ?? null;
}

/**
 * Heartbeat for a running execution: bumps `updatedAt` so `markInterruptedIfStale`
 * can tell a slow plan from a dead one.
 */
export async function touchExecuting(id: string) {
	await db
		.update(agentProposal)
		.set({ updatedAt: sql`now()` })
		.where(and(eq(agentProposal.id, id), eq(agentProposal.status, 'executing')));
}

/**
 * The fence. Locks the proposal row for the step's transaction and reports whether it is
 * still `executing`. A lease alone does not stop a slow executor that outlived it: once
 * `markInterruptedIfStale` has healed the row to `failed`, the old run's next step finds
 * no row here and rolls back with its mutation, instead of committing behind a terminal
 * status. On Vercel `maxDuration` happens to kill such a run; a persistent host has no
 * such backstop, which is why the check lives in the data.
 */
export async function lockExecuting(handle: DbHandle, id: string): Promise<boolean> {
	const [row] = await handle
		.select({ id: agentProposal.id })
		.from(agentProposal)
		.where(and(eq(agentProposal.id, id), eq(agentProposal.status, 'executing')))
		.for('update');
	return row !== undefined;
}

/**
 * Heal an `executing` row whose process died between a step and its terminal
 * transition: once the lease has lapsed it becomes `failed('interrupted')`. Lazy, like
 * `markExpiredIfPending` — it runs when someone next reads the proposal, and the step
 * receipts already say exactly which mutations committed, so nothing is re-run.
 */
export async function markInterruptedIfStale(id: string, leaseMs = EXECUTION_LEASE_MS) {
	const [row] = await db
		.update(agentProposal)
		.set({ status: 'failed', failureMessage: 'interrupted', updatedAt: new Date() })
		.where(
			and(
				eq(agentProposal.id, id),
				eq(agentProposal.status, 'executing'),
				lt(agentProposal.updatedAt, sql`now() - make_interval(secs => ${leaseMs / 1000})`),
			),
		)
		.returning();
	return row ?? null;
}

export interface ProposalStepReceiptInput {
	proposalId: string;
	stepIndex: number;
	toolName: string;
	kind: ProposalStepKind;
	output: unknown;
	errorMessage?: string;
	createdFileId?: string;
	recovery?: StepRecoveryPoint;
}

/**
 * Write one step's receipt. Runs on the caller's transaction — the same one that
 * performed the step's desk mutation — so the two commit together. A second execution
 * of the same `(proposal, step)` collides on the primary key and rolls back with it.
 */
export async function recordProposalStep(handle: DbHandle, input: ProposalStepReceiptInput) {
	const [row] = await handle
		.insert(agentProposalStep)
		.values({
			proposalId: input.proposalId,
			stepIndex: input.stepIndex,
			toolName: input.toolName,
			kind: input.kind,
			output: input.output ?? null,
			errorMessage: input.errorMessage ?? null,
			createdFileId: input.createdFileId ?? null,
			recovery: input.recovery ?? null,
		})
		.returning();
	return row;
}

/** The receipts a proposal has so far, in execution order. */
export async function listProposalSteps(proposalId: string) {
	return db
		.select()
		.from(agentProposalStep)
		.where(eq(agentProposalStep.proposalId, proposalId))
		.orderBy(asc(agentProposalStep.stepIndex));
}

// ── Revert: the compensating run of an executed plan ────────────────────────────────
// Same contract as the forward run (durable-step-execution): a conditional claim, a
// database-clock heartbeat, a fence in every step's transaction, receipts written with
// their effect. One revert per proposal — `revert_status` is claimed from null.

/**
 * Claim the undo of a plan that ran (`executed`, or `failed` with some steps done). The
 * conditional UPDATE is the exactly-once: a second request matches no row.
 */
export async function claimRevert(id: string, userId: string) {
	const [row] = await db
		.update(agentProposal)
		.set({ revertStatus: 'reverting', revertedBy: userId, updatedAt: sql`now()` })
		.where(
			and(
				eq(agentProposal.id, id),
				isNull(agentProposal.revertStatus),
				inArray(agentProposal.status, ['executed', 'failed']),
				// Ownership in the claim itself: the one undo a plan has cannot be spent by anyone
				// but the owner of its conversation, whichever door calls this.
				sql`exists (select 1 from ${conversation} where ${conversation.id} = ${agentProposal.conversationId} and ${conversation.userId} = ${userId})`,
			),
		)
		.returning();
	return row ?? null;
}

/**
 * Whether every step that ran recorded what undoing it needs. Plans executed before recovery
 * points existed did not, and an undo of them would claim success while undoing nothing.
 */
export async function hasRecoveryPoints(proposalId: string): Promise<boolean> {
	const steps = await listProposalSteps(proposalId);
	const ran = steps.filter((step) => step.kind === 'ok');
	return ran.length > 0 && ran.every((step) => step.recovery !== null);
}

/** The revert's fence — the forward run's `lockExecuting`, for `revert_status = 'reverting'`. */
export async function lockReverting(handle: DbHandle, id: string): Promise<boolean> {
	const [row] = await handle
		.select({ id: agentProposal.id })
		.from(agentProposal)
		.where(and(eq(agentProposal.id, id), eq(agentProposal.revertStatus, 'reverting')))
		.for('update');
	return row !== undefined;
}

/** Heartbeat between revert steps, on the database clock. */
export async function touchReverting(id: string) {
	await db
		.update(agentProposal)
		.set({ updatedAt: sql`now()` })
		.where(and(eq(agentProposal.id, id), eq(agentProposal.revertStatus, 'reverting')));
}

/** Terminal transition of the revert; null when it was already healed or finished. */
export async function finishRevert(id: string, outcome: 'reverted' | 'revert_failed') {
	const [row] = await db
		.update(agentProposal)
		.set({ revertStatus: outcome, revertedAt: sql`now()`, updatedAt: sql`now()` })
		.where(and(eq(agentProposal.id, id), eq(agentProposal.revertStatus, 'reverting')))
		.returning();
	return row ?? null;
}

/** A revert that outlived its lease is `revert_failed`; its receipts say what was undone. */
export async function markRevertInterruptedIfStale(id: string, leaseMs = EXECUTION_LEASE_MS) {
	const [row] = await db
		.update(agentProposal)
		.set({ revertStatus: 'revert_failed', revertedAt: sql`now()`, updatedAt: sql`now()` })
		.where(
			and(
				eq(agentProposal.id, id),
				eq(agentProposal.revertStatus, 'reverting'),
				lt(agentProposal.updatedAt, sql`now() - make_interval(secs => ${leaseMs / 1000})`),
			),
		)
		.returning();
	return row ?? null;
}

export interface RevertStepReceiptInput {
	proposalId: string;
	/** The forward step being undone. */
	stepIndex: number;
	kind: ProposalStepKind;
	errorMessage?: string;
}

/**
 * Write one revert receipt on the caller's transaction (the one that ran the compensating
 * mutation). The foreign key onto the forward receipt refuses a revert of a step that
 * never ran; the primary key refuses undoing one twice.
 */
export async function recordRevertStep(handle: DbHandle, input: RevertStepReceiptInput) {
	const [row] = await handle
		.insert(agentProposalRevertStep)
		.values({
			proposalId: input.proposalId,
			stepIndex: input.stepIndex,
			kind: input.kind,
			errorMessage: input.errorMessage ?? null,
		})
		.returning();
	return row;
}

/** The revert receipts a proposal has so far, by forward step. */
export async function listRevertSteps(proposalId: string) {
	return db
		.select()
		.from(agentProposalRevertStep)
		.where(eq(agentProposalRevertStep.proposalId, proposalId))
		.orderBy(asc(agentProposalRevertStep.stepIndex));
}
