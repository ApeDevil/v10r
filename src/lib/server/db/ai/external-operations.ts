/**
 * External operation persistence — the claim, the dispatch marker, the settlement and the
 * recovery of `ai.agent_external_operation`, each one conditional statement (or one
 * transaction) whose predicate is the rule it enforces.
 *
 *   pending ──claim──▶ claimed ──dispatch──▶ dispatched ──settle──▶ succeeded | failed | unknown
 *      │                  │ settle (refused before sending)              ▲
 *      └─ refuse ─▶ refused                 heal after the lease ────────┘ (claimed → failed/not_sent,
 *                                                                          dispatched → unknown/possibly_sent)
 *
 * No statement moves a row back to `pending`, so an approval is executed at most once whatever
 * the number of instances racing it, and a claim nobody settled is never re-run. Expiry and
 * lease time are the DATABASE clock (`now()`), like the proposal's.
 */
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import type { ExternalOperationDelivery, ExternalOperationStatus } from '#lib/types/db-enums.ts';
import { db } from '../index';
import { agentExternalOperation, type ExternalOperationResultRecord } from '../schema/ai/external-operation';
import { agentProposal } from '../schema/ai/proposal';

export type ExternalOperationRow = typeof agentExternalOperation.$inferSelect;
export type ExternalOperationInsert = Omit<
	typeof agentExternalOperation.$inferInsert,
	| 'proposalId'
	| 'status'
	| 'delivery'
	| 'reason'
	| 'result'
	| 'claimToken'
	| 'claimedAt'
	| 'dispatchedAt'
	| 'settledAt'
	| 'createdAt'
>;

/** The outcomes a settlement may write — never `pending`, `claimed` or `dispatched`. */
export type ExternalSettledStatus = Extract<ExternalOperationStatus, 'succeeded' | 'failed' | 'unknown' | 'refused'>;

export async function getExternalOperation(proposalId: string): Promise<ExternalOperationRow | null> {
	const [row] = await db
		.select()
		.from(agentExternalOperation)
		.where(eq(agentExternalOperation.proposalId, proposalId))
		.limit(1);
	return row ?? null;
}

/**
 * The execution claim. In ONE transaction: the proposal `approved → executing` (unexpired) and
 * the operation `pending → claimed` (unexpired, owned by `userId`). Either predicate failing
 * rolls both back and answers null — the loser of a race, an expired approval, a stranger.
 */
export async function claimExternalOperation(
	proposalId: string,
	userId: string,
	claimToken: string,
): Promise<ExternalOperationRow | null> {
	return db
		.transaction(async (tx) => {
			const [proposal] = await tx
				.update(agentProposal)
				.set({ status: 'executing', updatedAt: sql`now()` })
				.where(
					and(
						eq(agentProposal.id, proposalId),
						eq(agentProposal.status, 'approved'),
						sql`${agentProposal.expiresAt} > now()`,
					),
				)
				.returning({ id: agentProposal.id });
			if (!proposal) return null;
			const [row] = await tx
				.update(agentExternalOperation)
				.set({ status: 'claimed', claimToken, claimedAt: sql`now()` })
				.where(
					and(
						eq(agentExternalOperation.proposalId, proposalId),
						eq(agentExternalOperation.status, 'pending'),
						eq(agentExternalOperation.userId, userId),
						sql`${agentExternalOperation.expiresAt} > now()`,
					),
				)
				.returning();
			if (!row) {
				tx.rollback();
				return null;
			}
			return row;
		})
		.catch((error: unknown) => {
			// `tx.rollback()` surfaces as a TransactionRollbackError: the claim was lost, not broken.
			if (error instanceof Error && error.name === 'TransactionRollbackError') return null;
			throw error;
		});
}

/**
 * `claimed → dispatched`, written immediately BEFORE the request may leave. Null when this
 * executor no longer owns the claim (it was healed meanwhile): it must not send.
 */
export async function markExternalDispatched(proposalId: string, claimToken: string): Promise<boolean> {
	const rows = await db
		.update(agentExternalOperation)
		.set({ status: 'dispatched', dispatchedAt: sql`now()` })
		.where(
			and(
				eq(agentExternalOperation.proposalId, proposalId),
				eq(agentExternalOperation.claimToken, claimToken),
				eq(agentExternalOperation.status, 'claimed'),
			),
		)
		.returning({ id: agentExternalOperation.proposalId });
	return rows.length > 0;
}

export interface ExternalSettlement {
	status: ExternalSettledStatus;
	delivery: ExternalOperationDelivery;
	reason: string | null;
	result: ExternalOperationResultRecord | null;
}

/**
 * Record the outcome, and the proposal's terminal status with it, in one transaction. Only the
 * claim's owner can settle, and only from `claimed`/`dispatched`: a row healed to `unknown`
 * while a slow executor was still waiting is not overwritten by that executor's late answer.
 */
export async function settleExternalOperation(
	proposalId: string,
	claimToken: string,
	settlement: ExternalSettlement,
): Promise<ExternalOperationRow | null> {
	return db.transaction(async (tx) => {
		const [row] = await tx
			.update(agentExternalOperation)
			.set({ ...settlement, settledAt: sql`now()` })
			.where(
				and(
					eq(agentExternalOperation.proposalId, proposalId),
					eq(agentExternalOperation.claimToken, claimToken),
					inArray(agentExternalOperation.status, ['claimed', 'dispatched']),
				),
			)
			.returning();
		if (!row) return null;
		await tx
			.update(agentProposal)
			.set(
				settlement.status === 'succeeded'
					? { status: 'executed', executedAt: sql`now()`, updatedAt: sql`now()` }
					: { status: 'failed', failureMessage: `external_${settlement.status}`, updatedAt: sql`now()` },
			)
			.where(and(eq(agentProposal.id, proposalId), eq(agentProposal.status, 'executing')));
		return row;
	});
}

/** A pending operation whose approval can no longer run (expired, rejected) is `refused`; nothing was sent. */
export async function refusePendingExternalOperation(proposalId: string, reason: string) {
	const [row] = await db
		.update(agentExternalOperation)
		.set({ status: 'refused', delivery: 'not_sent', reason, settledAt: sql`now()` })
		.where(and(eq(agentExternalOperation.proposalId, proposalId), eq(agentExternalOperation.status, 'pending')))
		.returning();
	return row ?? null;
}

/**
 * Recovery after an interruption: a claim older than the lease that never settled is settled
 * from the side of the wire it stopped on — `claimed` (nothing left yet) as `failed`/`not_sent`,
 * `dispatched` as `unknown`/`possibly_sent`. Its proposal becomes `failed('interrupted')`.
 * Never re-executed: the row leaves the claimable state for good.
 */
export async function healInterruptedExternalOperation(proposalId: string, leaseMs: number) {
	const stale = sql`now() - make_interval(secs => ${leaseMs / 1000})`;
	return db.transaction(async (tx) => {
		const [beforeDispatch] = await tx
			.update(agentExternalOperation)
			.set({ status: 'failed', delivery: 'not_sent', reason: 'interrupted_before_dispatch', settledAt: sql`now()` })
			.where(
				and(
					eq(agentExternalOperation.proposalId, proposalId),
					eq(agentExternalOperation.status, 'claimed'),
					lt(agentExternalOperation.claimedAt, stale),
				),
			)
			.returning();
		const [afterDispatch] = beforeDispatch
			? []
			: await tx
					.update(agentExternalOperation)
					.set({ status: 'unknown', delivery: 'possibly_sent', reason: 'interrupted', settledAt: sql`now()` })
					.where(
						and(
							eq(agentExternalOperation.proposalId, proposalId),
							eq(agentExternalOperation.status, 'dispatched'),
							lt(agentExternalOperation.dispatchedAt, stale),
						),
					)
					.returning();
		const healed = beforeDispatch ?? afterDispatch ?? null;
		if (healed) {
			await tx
				.update(agentProposal)
				.set({ status: 'failed', failureMessage: 'interrupted', updatedAt: sql`now()` })
				.where(and(eq(agentProposal.id, proposalId), eq(agentProposal.status, 'executing')));
		}
		return healed;
	});
}

/**
 * External operations of one protocol already proposed in a conversation, whatever their
 * outcome — the per-conversation bound a delegation budget starts from. Read from the rows the
 * client cannot write, so trimming the history sent with a turn does not reset it.
 */
export async function countConversationExternalOperations(
	conversationId: string,
	protocol: ExternalOperationRow['protocol'],
): Promise<number> {
	const [row] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(agentExternalOperation)
		.innerJoin(agentProposal, eq(agentProposal.id, agentExternalOperation.proposalId))
		.where(and(eq(agentProposal.conversationId, conversationId), eq(agentExternalOperation.protocol, protocol)));
	return row?.count ?? 0;
}
