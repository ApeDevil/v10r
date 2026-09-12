/**
 * Proposal lifecycle mutations.
 *
 * State machine: `pending → approved → executing → executed | failed`
 *                `       ↓         ↓              `
 *                `    rejected   (retry = new row)`
 *
 * Exactly-once execution is enforced by the partial unique index on
 * `agent_proposal` at schema level — concurrent `markExecuting` calls
 * for the same proposal collide there. Readers handle the collision by
 * reading the existing row instead of racing. What each step did is the
 * `agent_proposal_step` receipt, written in the step's own transaction.
 */
import { and, asc, eq, gt, lt, sql } from 'drizzle-orm';
import type { ProposalStepKind } from '$lib/types/db-enums';
import { createId } from '../id';
import { type DbHandle, db } from '../index';
import { agentProposal, type ProposedToolCall } from '../schema/ai/proposal';
import { agentProposalStep } from '../schema/ai/proposal-step';

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
 * The approve route's function has a 60 s ceiling and touches the row between steps,
 * so a row silent for twice that was interrupted — its receipts say which steps ran.
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
		.set({ status: 'executing', updatedAt: new Date() })
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
		.set({ updatedAt: new Date() })
		.where(and(eq(agentProposal.id, id), eq(agentProposal.status, 'executing')));
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
				lt(agentProposal.updatedAt, new Date(Date.now() - leaseMs)),
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
