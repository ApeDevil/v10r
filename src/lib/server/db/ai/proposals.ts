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
import { and, eq, sql } from 'drizzle-orm';
import { createId } from '../id';
import { db } from '../index';
import { agentProposal, type ProposalExecutionResult, type ProposedToolCall } from '../schema/ai/proposal';

const DEFAULT_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes — stale proposals auto-expire

export interface CreateProposalInput {
	conversationId: string;
	messageId: string;
	riskTier?: 'low' | 'medium' | 'high';
	payload: ProposedToolCall[];
	rationale?: string;
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

/** Transition `pending → approved`. Returns the updated row, or null if the transition was illegal. */
export async function approveProposal(id: string, approvedByUserId: string) {
	const [row] = await db
		.update(agentProposal)
		.set({
			status: 'approved',
			approvedBy: approvedByUserId,
			approvedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(and(eq(agentProposal.id, id), eq(agentProposal.status, 'pending')))
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
 */
export async function markExecuting(id: string) {
	const [row] = await db
		.update(agentProposal)
		.set({ status: 'executing', updatedAt: new Date() })
		.where(and(eq(agentProposal.id, id), eq(agentProposal.status, 'approved')))
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

/** Transition `executing → failed`. */
export async function markFailed(id: string, message: string) {
	const [row] = await db
		.update(agentProposal)
		.set({
			status: 'failed',
			failureMessage: message,
			updatedAt: new Date(),
		})
		.where(and(eq(agentProposal.id, id), eq(agentProposal.status, 'executing')))
		.returning();
	return row ?? null;
}

/** Sweep pending proposals past their expiry. Idempotent — safe to run on every cron tick. */
export async function expireStaleProposals() {
	const rows = await db
		.update(agentProposal)
		.set({ status: 'expired', updatedAt: new Date() })
		.where(and(eq(agentProposal.status, 'pending'), sql`${agentProposal.expiresAt} < now()`))
		.returning({ id: agentProposal.id });
	return rows.length;
}
