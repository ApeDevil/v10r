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
 * reading the existing row instead of racing.
 */
import { and, eq, gt, sql } from 'drizzle-orm';
import { createId } from '../id';
import { db } from '../index';
import { agentProposal, type ProposalExecutionResult, type ProposedToolCall } from '../schema/ai/proposal';

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
 * can tell the two apart. The shape test in `proposals.test.ts` pins the intent.
 */
const notExpired = () => gt(agentProposal.expiresAt, sql`now()`);

const DEFAULT_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes — stale proposals auto-expire

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

/** Transition `executing → executed` with cached result for idempotent retries. */
export async function markExecuted(id: string, result: ProposalExecutionResult) {
	const now = new Date();
	const [row] = await db
		.update(agentProposal)
		.set({
			status: 'executed',
			executionResult: result,
			executedAt: now,
			updatedAt: now,
		})
		.where(and(eq(agentProposal.id, id), eq(agentProposal.status, 'executing')))
		.returning();
	return row ?? null;
}

/**
 * Transition `executing → failed`. Persists any partial execution result so the
 * audit trail reflects which steps actually ran before the failure (the approve
 * route executes sequentially with no rollback — earlier mutations stick).
 */
export async function markFailed(id: string, message: string, partialResult?: ProposalExecutionResult) {
	const [row] = await db
		.update(agentProposal)
		.set({
			status: 'failed',
			failureMessage: message,
			executionResult: partialResult ?? null,
			updatedAt: new Date(),
		})
		.where(and(eq(agentProposal.id, id), eq(agentProposal.status, 'executing')))
		.returning();
	return row ?? null;
}
