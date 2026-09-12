/**
 * POST /api/ai/proposals/[id]/approve — execute an approved proposal.
 *
 * State machine:
 *   `pending → approved → executing → (executed | failed)`
 *
 * **Idempotency**: `proposalId` IS the idempotency key. The partial unique
 * index on `agent_proposal` (see `db/schema/ai/proposal.ts`) ensures at most
 * one row is simultaneously in `executing` or `executed` state. Concurrent
 * approvals find the existing row and answer from its step receipts.
 *
 * Flow — this handler is the adapter; `executeProposal` is the work:
 *   1. Auth + ownership check (conversation must belong to caller).
 *   2. Heal a stale `executing` row (process died mid-plan) into `failed`.
 *   3. Terminal rows answer with their receipts; an in-flight row is a 409 carrying
 *      the receipts so far.
 *   4. Transition `pending → approved`, then `approved → executing` (may collide).
 *   5. `executeProposal` — receipts in the mutations' transactions, receipt message.
 *
 * DELETE on the same URL rejects a still-pending proposal.
 */

import { executeProposal, proposalOutcome } from '$lib/server/ai/proposals/execute-proposal';
import {
	approveProposal,
	getProposal,
	getProposalWithExpiry,
	markExecuting,
	markExpiredIfPending,
	markInterruptedIfStale,
	rejectProposal,
} from '$lib/server/db/ai/proposals';
import { getConversation } from '$lib/server/db/ai/queries';
import { classifyDbError, safeDbMessage } from '$lib/server/db/errors';
import { guardApiUser } from '$lib/server/http/guards';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiError, apiOk } from '$lib/server/http/response';
import type { RequestHandler } from './$types';

// Proposal execution runs desk mutations; cap per-user throughput. Idempotency
// caps repeat-execution of one proposal, but not a flood of distinct proposals.
const executeLimiter = createLimiter('rl:ai:proposal:execute', 20, '1 m');

/**
 * Turn a refused `pending → approved` into an honest error code.
 *
 * `approveProposal` returns null for two different reasons — the status moved on
 * under us, or the 15-minute consent window closed — and the zero-row result
 * cannot distinguish them. Ask the database which it was. Callers have already
 * been denied at this point; this only picks the wording.
 */
async function explainRefusedApproval(id: string) {
	const row = await getProposalWithExpiry(id);
	if (!row) return apiError(404, 'not_found', 'Proposal not found.');
	if (row.proposal.status === 'pending' && row.isExpired) {
		// Self-heal so the next read reports `expired` instead of a pending row
		// that can never be approved. Best-effort: the refusal above already holds.
		await markExpiredIfPending(id);
		return apiError(
			409,
			'proposal_expired',
			'This proposal expired before it was approved. Ask again to get a fresh one.',
		);
	}
	return apiError(409, 'proposal_state_changed', 'Proposal state changed — reload.');
}

export const POST: RequestHandler = async ({ params, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await executeLimiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	try {
		// 1. Load the proposal and verify ownership via the parent conversation.
		let proposal = await getProposal(params.id);
		if (!proposal) return apiError(404, 'not_found', 'Proposal not found.');

		const conv = await getConversation(proposal.conversationId, user.id);
		if (!conv) return apiError(404, 'not_found', 'Proposal not found.');

		// 2. A row still `executing` long after its last heartbeat was interrupted; its
		//    receipts already say which steps ran.
		if (proposal.status === 'executing') proposal = (await markInterruptedIfStale(proposal.id)) ?? proposal;

		// 3. Terminal and in-flight rows never re-run anything. `executed` answers with its
		//    receipts and their effects (a retried approval still has to refresh the desk);
		//    the others are refusals — the client reads `GET /api/ai/proposals/[id]` for
		//    the receipts behind them.
		if (proposal.status === 'executed') return apiOk(await proposalOutcome(proposal));
		if (proposal.status === 'executing') {
			return apiError(
				409,
				'proposal_in_flight',
				'Proposal is already executing. Poll /api/ai/proposals/[id] for status.',
			);
		}
		if (proposal.status === 'rejected' || proposal.status === 'expired' || proposal.status === 'failed') {
			return apiError(409, `proposal_${proposal.status}`, `Proposal is ${proposal.status} and cannot be executed.`);
		}

		// 4. Transition pending → approved (no-op if already approved). The
		//    expiry bound lives in that statement's predicate, not here — a
		//    check on the row we read at step 1 would be a TOCTOU window.
		if (proposal.status === 'pending') {
			const approved = await approveProposal(proposal.id, user.id);
			if (!approved) return await explainRefusedApproval(proposal.id);
		}

		// Transition approved → executing. Partial unique index protects
		// us from concurrent executors.
		const claimed = await markExecuting(proposal.id);
		if (!claimed) {
			// Someone else claimed it between our `approveProposal` and here —
			// or the window closed between approval and execution, which is why
			// `markExecuting` carries the expiry bound too. Re-read and report.
			const fresh = await getProposalWithExpiry(proposal.id);
			if (fresh?.proposal.status === 'executed') return apiOk(await proposalOutcome(fresh.proposal));
			if (fresh?.proposal.status === 'approved' && fresh.isExpired) {
				return apiError(409, 'proposal_expired', 'This proposal expired before it ran. Ask again to get a fresh one.');
			}
			return apiError(409, 'proposal_in_flight', 'Proposal is already executing.');
		}

		// 5. Run it.
		return apiOk(await executeProposal(claimed, user.id));
	} catch (err) {
		const dbErr = classifyDbError(err);
		return apiError(dbErr.toStatus(), dbErr.kind, safeDbMessage(dbErr.kind));
	}
};

/** DELETE /api/ai/proposals/[id]/approve — reject a pending proposal. */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	try {
		const proposal = await getProposal(params.id);
		if (!proposal) return apiError(404, 'not_found', 'Proposal not found.');

		const conv = await getConversation(proposal.conversationId, user.id);
		if (!conv) return apiError(404, 'not_found', 'Proposal not found.');

		if (proposal.status !== 'pending') {
			return apiError(409, `proposal_${proposal.status}`, `Proposal is ${proposal.status} — cannot reject.`);
		}

		const rejected = await rejectProposal(proposal.id, 'user_rejected');
		if (!rejected) return apiError(409, 'proposal_state_changed', 'Proposal state changed — reload.');

		return apiOk({ id: proposal.id, status: 'rejected' });
	} catch (err) {
		const dbErr = classifyDbError(err);
		return apiError(dbErr.toStatus(), dbErr.kind, safeDbMessage(dbErr.kind));
	}
};
