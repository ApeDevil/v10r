import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError, apiOk } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import { API_READ_RATE_LIMIT_MAX, API_READ_RATE_LIMIT_WINDOW } from '$lib/server/config';
import { Neo4jError } from '$lib/server/graph/errors';
import { getEntityNeighborhood } from '$lib/server/graph/rag/queries';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:retrieval:graph:node', API_READ_RATE_LIMIT_MAX, API_READ_RATE_LIMIT_WINDOW);

export const GET: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiUser(locals);

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const { elementId } = params;
	if (!elementId) {
		return apiError(400, 'missing_id', 'Element ID is required.');
	}

	try {
		const data = await getEntityNeighborhood(elementId);
		if (data.nodes.length === 0) {
			return apiError(404, 'not_found', 'Entity not found.');
		}
		return apiOk(data);
	} catch (err) {
		if (err instanceof Neo4jError) {
			return apiError(err.httpStatus, 'graph_error', err.message);
		}
		console.error('[api:retrieval:graph:node] Error:', err instanceof Error ? err.message : err);
		return apiError(500, 'expand_failed', 'Failed to expand node neighborhood.');
	}
};
