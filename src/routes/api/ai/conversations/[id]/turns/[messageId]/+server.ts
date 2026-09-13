/**
 * GET /api/ai/conversations/[id]/turns/[messageId] — one turn's full trace, for its owner.
 *
 * The recorded account of what the turn did (`$lib/types/turn-trace.ts`): the prompt blocks
 * with their text, every model call's request outline and usage, every tool execution with
 * its model-facing result, the grounding candidates with bodies resolved by id, the
 * attempts and the citations. Owner-scoped twice over — the turn row's own `user_id` and the
 * conversation in the path must both be the caller's — and a miss on either reads as 404, so
 * the route cannot be used to probe other people's ids.
 *
 * Grounding bodies resolve against the caller's own corpus plus the system docs corpus,
 * exactly the owner set `retrieve()` searched for the turn; a body that has changed since is
 * marked `drifted`, never silently swapped. A deskbot turn that stopped on a proposal gets
 * the proposal resolved the same way — by id, as it stands now, with its receipts.
 */
import {
	CONVERSATION_RATE_LIMIT_MAX,
	CONVERSATION_RATE_LIMIT_PREFIX,
	CONVERSATION_RATE_LIMIT_WINDOW,
} from '$lib/server/ai/config';
import { resolveTurnProposal } from '$lib/server/ai/proposals/turn-proposal';
import { getTurn, resolveGroundingBodies } from '$lib/server/db/ai/queries';
import { classifyDbError, safeDbMessage } from '$lib/server/db/errors';
import { guardApiUser } from '$lib/server/http/guards';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiError, apiOk } from '$lib/server/http/response';
import { SYSTEM_DOCS_USER_ID } from '$lib/server/retrieval/config';
import type { RequestHandler } from './$types';

const ratelimit = createLimiter(
	CONVERSATION_RATE_LIMIT_PREFIX,
	CONVERSATION_RATE_LIMIT_MAX,
	CONVERSATION_RATE_LIMIT_WINDOW,
);

export const GET: RequestHandler = async ({ params, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await ratelimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	try {
		const trace = await getTurn(params.messageId, user.id);
		if (!trace || trace.conversationId !== params.id) return apiError(404, 'not_found', 'Turn not found.');
		return apiOk(await resolveTurnProposal(await resolveGroundingBodies(trace, [SYSTEM_DOCS_USER_ID, user.id])));
	} catch (err) {
		const dbErr = classifyDbError(err);
		return apiError(dbErr.toStatus(), dbErr.kind, safeDbMessage(dbErr.kind));
	}
};
