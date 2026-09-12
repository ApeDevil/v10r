/**
 * GET /api/ai/proposals/[id] — the current outcome of a proposal.
 *
 * The client's recovery path: after a lost `/approve` response, a 409, a remount or a
 * reload it reads the status and the step receipts here instead of approving again.
 * Answers the same `ProposalOutcome` shape as the approve route, receipts and effects
 * included, so a panel can still reload the file a completed step changed.
 */

import { proposalOutcome } from '$lib/server/ai/proposals/execute-proposal';
import { getProposal, markExpiredIfPending, markInterruptedIfStale } from '$lib/server/db/ai/proposals';
import { getConversation } from '$lib/server/db/ai/queries';
import { classifyDbError, safeDbMessage } from '$lib/server/db/errors';
import { guardApiUser } from '$lib/server/http/guards';
import { apiError, apiOk } from '$lib/server/http/response';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	try {
		let proposal = await getProposal(params.id);
		if (!proposal) return apiError(404, 'not_found', 'Proposal not found.');

		// Ownership check — user must own the parent conversation.
		const conv = await getConversation(proposal.conversationId, user.id);
		if (!conv) return apiError(404, 'not_found', 'Proposal not found.');

		// Reads heal what time has settled: a pending row past its window is `expired`, an
		// executing row past its lease is `failed('interrupted')` — with its receipts intact.
		if (proposal.status === 'pending') proposal = (await markExpiredIfPending(proposal.id)) ?? proposal;
		if (proposal.status === 'executing') proposal = (await markInterruptedIfStale(proposal.id)) ?? proposal;

		return apiOk(await proposalOutcome(proposal));
	} catch (err) {
		const dbErr = classifyDbError(err);
		return apiError(dbErr.toStatus(), dbErr.kind, safeDbMessage(dbErr.kind));
	}
};
