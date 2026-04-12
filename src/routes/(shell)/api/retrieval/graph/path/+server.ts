import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError, apiOk } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import { API_READ_RATE_LIMIT_MAX, API_READ_RATE_LIMIT_WINDOW } from '$lib/server/config';
import { Neo4jError } from '$lib/server/graph/errors';
import { findShortestPath } from '$lib/server/graph/rag/queries';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:retrieval:graph:path', API_READ_RATE_LIMIT_MAX, API_READ_RATE_LIMIT_WINDOW);

export const GET: RequestHandler = async ({ url, locals }) => {
	const { user } = requireApiUser(locals);

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const fromId = url.searchParams.get('from');
	const toId = url.searchParams.get('to');
	const maxHopsParam = url.searchParams.get('maxHops');

	if (!fromId || !toId) {
		return apiError(400, 'missing_params', 'Both "from" and "to" element IDs are required.');
	}
	if (fromId === toId) {
		return apiError(400, 'same_node', 'Start and end must be different entities.');
	}

	const maxHops = maxHopsParam ? Math.min(Math.max(parseInt(maxHopsParam, 10) || 4, 1), 6) : 4;

	try {
		const path = await findShortestPath(fromId, toId, maxHops);
		if (!path) {
			return apiError(404, 'path_not_found', `No path found within ${maxHops} hops.`);
		}
		return apiOk(path);
	} catch (err) {
		if (err instanceof Neo4jError) {
			return apiError(err.toStatus(), 'graph_error', err.message);
		}
		console.error('[api:retrieval:graph:path] Error:', err instanceof Error ? err.message : err);
		return apiError(500, 'path_failed', 'Failed to find path.');
	}
};
