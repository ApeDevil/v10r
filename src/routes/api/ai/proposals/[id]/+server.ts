/**
 * GET /api/ai/proposals/[id] — the current outcome of a proposal.
 *
 * The client's recovery path: after a lost `/approve` response, a 409, a remount or a
 * reload it reads the status and the step receipts here instead of approving again.
 * Answers the same `ProposalOutcome` shape as the approve route, receipts and effects
 * included, so a panel can still reload the file a completed step changed.
 */

import { recoverExternalProposal } from '#lib/server/ai/proposals/external-approval.ts';
import { proposalOutcome } from '#lib/server/ai/proposals/proposal-outcome.ts';
import {
	getProposal,
	markExpiredIfPending,
	markInterruptedIfStale,
	markRevertInterruptedIfStale,
} from '#lib/server/db/ai/proposals.ts';
import { getConversation } from '#lib/server/db/ai/queries.ts';
import { classifyDbError, safeDbMessage } from '#lib/server/db/errors.ts';
import { guardApiUser } from '#lib/server/http/guards.ts';
import { apiError, apiOk } from '#lib/server/http/response.ts';
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
		// An external operation is healed by its own row, never by the proposal's lease: a claim
		// that never settled is settled from the side of the wire it stopped on (`unknown` once
		// dispatched) and never re-run, a pending row that can no longer run is refused, and a
		// settled row whose receipt message was lost gets it back, rebuilt from the row. The
		// proposal-level lease below would fail an external proposal whose call is still inside
		// its own lease (that one runs from the dispatch), so it is for desk plans only.
		const external = await recoverExternalProposal(proposal.id);
		if (external) proposal = (await getProposal(proposal.id)) ?? proposal;
		else if (proposal.status === 'executing') proposal = (await markInterruptedIfStale(proposal.id)) ?? proposal;
		// A revert whose process died is healed the same way; a client polling after a lost
		// undo response would otherwise wait on `reverting` forever.
		if (proposal.revertStatus === 'reverting') proposal = (await markRevertInterruptedIfStale(proposal.id)) ?? proposal;

		const outcome = await proposalOutcome(proposal);
		return apiOk(external ? { ...outcome, receiptMessage: external.receiptMessage } : outcome);
	} catch (err) {
		const dbErr = classifyDbError(err);
		return apiError(dbErr.toStatus(), dbErr.kind, safeDbMessage(dbErr.kind));
	}
};
