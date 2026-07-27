/**
 * POST /api/ai/proposals/[id]/approve — execute an approved proposal.
 *
 * State machine:
 *   `pending → approved → executing → (executed | failed)`
 *
 * **Idempotency**: `proposalId` IS the idempotency key. The partial unique
 * index on `agent_proposal` (see `db/schema/ai/proposal.ts`) ensures at most
 * one row is simultaneously in `executing` or `executed` state. Concurrent
 * approvals find the existing row and return its cached result.
 *
 * Flow:
 *   1. Auth + ownership check (conversation must belong to caller).
 *   2. Transition `pending → approved`. If already approved/executed, read
 *      the existing row and return its state.
 *   3. Transition `approved → executing` (may collide if racing).
 *   4. Run the payload tool calls via the desk domain modules (same path
 *      the in-loop tool `execute` functions use — multi-client core rule).
 *   5. Transition `executing → executed` or `failed` with the cached result.
 *
 * DELETE on the same URL rejects a still-pending proposal.
 */

import type { DeskToolScope } from '$lib/server/ai/tools/_types';
import { executeDeskToolCall } from '$lib/server/ai/tools/desk-execute';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError, apiOk } from '$lib/server/api/response';
import { guardApiUser } from '$lib/server/auth/guards';
import {
	approveProposal,
	getProposal,
	markExecuted,
	markExecuting,
	markFailed,
	rejectProposal,
} from '$lib/server/db/ai/proposals';
import { getConversation } from '$lib/server/db/ai/queries';
import { classifyDbError, safeDbMessage } from '$lib/server/db/errors';
import type { ProposalExecutionResult } from '$lib/server/db/schema/ai/proposal';
import type { RequestHandler } from './$types';

// Proposal execution runs desk mutations; cap per-user throughput. Idempotency
// caps repeat-execution of one proposal, but not a flood of distinct proposals.
const executeLimiter = createLimiter('rl:ai:proposal:execute', 20, '1 m');

export const POST: RequestHandler = async ({ params, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await executeLimiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	try {
		// 1. Load the proposal and verify ownership via the parent conversation.
		const proposal = await getProposal(params.id);
		if (!proposal) return apiError(404, 'not_found', 'Proposal not found.');

		const conv = await getConversation(proposal.conversationId, user.id);
		if (!conv) return apiError(404, 'not_found', 'Proposal not found.');

		// 2. Idempotency: if the proposal has already been executed, return
		//    the cached result. If it's executing/failed/rejected/expired,
		//    surface the current state instead of re-running.
		if (proposal.status === 'executed') {
			return apiOk({
				id: proposal.id,
				status: 'executed',
				executionResult: proposal.executionResult,
				executedAt: proposal.executedAt,
			});
		}
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

		// 3. Transition pending → approved (no-op if already approved).
		if (proposal.status === 'pending') {
			const approved = await approveProposal(proposal.id, user.id);
			if (!approved) return apiError(409, 'proposal_state_changed', 'Proposal state changed — reload.');
		}

		// 4. Transition approved → executing. Partial unique index protects
		//    us from concurrent executors.
		const claimed = await markExecuting(proposal.id);
		if (!claimed) {
			// Someone else claimed it between our `approveProposal` and here.
			// Re-read and return the current state.
			const fresh = await getProposal(proposal.id);
			if (fresh?.status === 'executed') {
				return apiOk({
					id: fresh.id,
					status: 'executed',
					executionResult: fresh.executionResult,
					executedAt: fresh.executedAt,
				});
			}
			return apiError(409, 'proposal_in_flight', 'Proposal is already executing.');
		}

		// 5. Run the payload, collect results, transition executed / failed.
		const results: ProposalExecutionResult['results'] = [];
		for (const step of proposal.payload) {
			// Replay under the scopes frozen when the plan was PROPOSED, never
			// anything supplied on this request — approval must not be able to
			// widen the grant the user reviewed.
			const outcome = await executeDeskToolCall(
				{
					userId: user.id,
					scopes: (proposal.grantedScopes ?? []) as DeskToolScope[],
					actor: 'proposal-replay',
				},
				step.toolName,
				step.args,
			);
			if (outcome.ok) {
				results.push({ toolName: step.toolName, ok: true, output: outcome.output });
			} else {
				results.push({
					toolName: step.toolName,
					ok: false,
					output: outcome.output,
					errorMessage: outcome.errorMessage,
				});
				// Short-circuit on first failure — the plan is a sequence, not a batch.
				// Persist the partial results (earlier steps already mutated — there is no
				// rollback) so the proposal's audit trail isn't lost to a bare message.
				const partialResult: ProposalExecutionResult = { toolCallIds: [], results };
				await markFailed(proposal.id, outcome.errorMessage, partialResult);
				return apiOk({
					id: proposal.id,
					status: 'failed',
					executionResult: partialResult,
					failureMessage: outcome.errorMessage,
				});
			}
		}

		const executionResult: ProposalExecutionResult = { toolCallIds: [], results };
		await markExecuted(proposal.id, executionResult);

		return apiOk({
			id: proposal.id,
			status: 'executed',
			executionResult,
			executedAt: new Date().toISOString(),
		});
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
