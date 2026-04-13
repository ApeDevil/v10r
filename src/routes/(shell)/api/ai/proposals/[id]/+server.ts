/**
 * GET /api/ai/proposals/[id] — fetch the current status of a proposal.
 *
 * Used by the client to poll after a flaky network or a page reload,
 * when the original POST response to `/approve` was lost. Reading the
 * proposal status is the idempotent recovery path.
 */
import { apiError, apiOk } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import { getProposal } from '$lib/server/db/ai/proposals';
import { getConversation } from '$lib/server/db/ai/queries';
import { classifyDbError, safeDbMessage } from '$lib/server/db/errors';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiUser(locals);

	try {
		const proposal = await getProposal(params.id);
		if (!proposal) return apiError(404, 'not_found', 'Proposal not found.');

		// Ownership check — user must own the parent conversation.
		const conv = await getConversation(proposal.conversationId, user.id);
		if (!conv) return apiError(404, 'not_found', 'Proposal not found.');

		return apiOk({
			id: proposal.id,
			status: proposal.status,
			riskTier: proposal.riskTier,
			payload: proposal.payload,
			rationale: proposal.rationale,
			approvedAt: proposal.approvedAt,
			executedAt: proposal.executedAt,
			executionResult: proposal.executionResult,
			failureMessage: proposal.failureMessage,
			expiresAt: proposal.expiresAt,
		});
	} catch (err) {
		const dbErr = classifyDbError(err);
		return apiError(dbErr.toStatus(), dbErr.kind, safeDbMessage(dbErr.kind));
	}
};
