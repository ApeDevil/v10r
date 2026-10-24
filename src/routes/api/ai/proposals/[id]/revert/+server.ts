/**
 * POST /api/ai/proposals/[id]/revert — undo a plan that ran.
 *
 * The adapter half of `revertProposal`: auth, ownership, rate limit, and the idempotent
 * answers. The undo itself is compensation, step by step, each a compare-and-swap against
 * what the plan left behind — see `ai/proposals/revert-proposal.ts`.
 *
 * Idempotency: one revert per proposal. The claim is a conditional UPDATE from a null
 * `revert_status`, so a double-tap finds the revert already claimed and answers from its
 * receipts. A revert still `reverting` long after its last heartbeat is healed to
 * `revert_failed` first; its receipts say which steps were undone.
 */

import { proposalOutcome } from '#lib/server/ai/proposals/proposal-outcome.ts';
import { revertProposal } from '#lib/server/ai/proposals/revert-proposal.ts';
import { getProposal, hasRecoveryPoints, markRevertInterruptedIfStale } from '#lib/server/db/ai/proposals.ts';
import { getConversation } from '#lib/server/db/ai/queries.ts';
import { classifyDbError, safeDbMessage } from '#lib/server/db/errors.ts';
import { guardApiUser } from '#lib/server/http/guards.ts';
import { createLimiter, rateLimitResponse } from '#lib/server/http/rate-limit.ts';
import { apiError, apiOk } from '#lib/server/http/response.ts';
import type { RequestHandler } from './$types';

// The undo runs inside this request, like the plan did; the same ceiling the approve route
// declares, which the shared heartbeat lease (`EXECUTION_LEASE_MS`) is sized against.
export const config = { runtime: 'nodejs22.x', maxDuration: 60 };

// An undo runs desk mutations; cap per-user throughput like the approve door does.
const revertLimiter = createLimiter('rl:ai:proposal:revert', 20, '1 m');

export const POST: RequestHandler = async ({ params, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await revertLimiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	try {
		let proposal = await getProposal(params.id);
		if (!proposal) return apiError(404, 'not_found', 'Proposal not found.');

		const conv = await getConversation(proposal.conversationId, user.id);
		if (!conv) return apiError(404, 'not_found', 'Proposal not found.');

		if (proposal.revertStatus === 'reverting') {
			proposal = (await markRevertInterruptedIfStale(proposal.id)) ?? proposal;
		}
		if (proposal.revertStatus === 'reverting') {
			return apiError(409, 'revert_in_flight', 'The undo is already running. Poll /api/ai/proposals/[id] for status.');
		}
		// Already undone (or the undo already ended): answer from its receipts, never re-run.
		if (proposal.revertStatus !== null) return apiOk(await proposalOutcome(proposal));

		if (proposal.status !== 'executed' && proposal.status !== 'failed') {
			return apiError(409, `proposal_${proposal.status}`, `Proposal is ${proposal.status} — nothing ran to undo.`);
		}

		if (!(await hasRecoveryPoints(proposal.id))) {
			return apiError(409, 'revert_unavailable', 'This plan ran before undo was recorded, so it cannot be undone.');
		}

		const outcome = await revertProposal(proposal, user.id);
		if (outcome) return apiOk(outcome);

		// The claim was lost to a concurrent request between our read and the UPDATE.
		const fresh = await getProposal(proposal.id);
		if (fresh?.revertStatus && fresh.revertStatus !== 'reverting') return apiOk(await proposalOutcome(fresh));
		return apiError(409, 'revert_in_flight', 'The undo is already running.');
	} catch (err) {
		const dbErr = classifyDbError(err);
		return apiError(dbErr.toStatus(), dbErr.kind, safeDbMessage(dbErr.kind));
	}
};
