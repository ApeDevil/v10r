import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError, apiOk } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import { API_READ_RATE_LIMIT_MAX, API_READ_RATE_LIMIT_WINDOW, SYSTEM_DOCS_USER_ID } from '$lib/server/config';
import { Neo4jError } from '$lib/server/graph/errors';
import { getAllRagEntities } from '$lib/server/graph/rag/queries';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:retrieval:graph', API_READ_RATE_LIMIT_MAX, API_READ_RATE_LIMIT_WINDOW);

// Owner-scoped (Wave 2.1): a user sees only their own RAG graph plus the shared
// system-docs corpus.
export const GET: RequestHandler = async ({ locals }) => {
	const { user } = requireApiUser(locals);

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	try {
		const data = await getAllRagEntities([user.id, SYSTEM_DOCS_USER_ID]);
		return apiOk(data);
	} catch (err) {
		if (err instanceof Neo4jError) {
			return apiError(err.toStatus(), 'graph_error', err.message);
		}
		console.error('[api:retrieval:graph] Error:', err instanceof Error ? err.message : err);
		return apiError(500, 'graph_failed', 'Failed to load graph data.');
	}
};
