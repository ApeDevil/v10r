import { Neo4jError, safeGraphMessage } from '$lib/server/graph/errors';
import { getEntityNeighborhood } from '$lib/server/graph/retrieval/queries';
import { READ_RATE_LIMIT_MAX, READ_RATE_LIMIT_WINDOW } from '$lib/server/http/config';
import { guardApiUser } from '$lib/server/http/guards';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiError, apiOk } from '$lib/server/http/response';
import { SYSTEM_DOCS_USER_ID } from '$lib/server/retrieval/config';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:retrieval:graph:node', READ_RATE_LIMIT_MAX, READ_RATE_LIMIT_WINDOW);

// Owner-scoped (Wave 2.1): a non-owned elementId yields an empty neighborhood → 404.
export const GET: RequestHandler = async ({ params, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const { elementId } = params;
	if (!elementId) {
		return apiError(400, 'missing_id', 'Element ID is required.');
	}

	try {
		const data = await getEntityNeighborhood(elementId, [user.id, SYSTEM_DOCS_USER_ID]);
		if (data.nodes.length === 0) {
			return apiError(404, 'not_found', 'Entity not found.');
		}
		return apiOk(data);
	} catch (err) {
		if (err instanceof Neo4jError) {
			// Launder the driver message: it can echo Cypher fragments (label and
			// property names). Mirrors safeDbMessage() on the Postgres path.
			return apiError(err.toStatus(), 'graph_error', safeGraphMessage(err.kind));
		}
		console.error('[api:retrieval:graph:node] Error:', err instanceof Error ? err.message : err);
		return apiError(500, 'expand_failed', 'Failed to expand node neighborhood.');
	}
};
