import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiOk, apiNoContent, apiError } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import {
	API_READ_RATE_LIMIT_MAX,
	API_READ_RATE_LIMIT_WINDOW,
	API_WRITE_RATE_LIMIT_MAX,
	API_WRITE_RATE_LIMIT_WINDOW,
} from '$lib/server/config';
import { deleteDocument } from '$lib/server/db/rag/mutations';
import { getDocument } from '$lib/server/db/rag/queries';
import { deleteDocumentGraph } from '$lib/server/graph/rag/mutations';
import type { RequestHandler } from './$types';

const readLimiter = createLimiter('rl:retrieval:documents:read', API_READ_RATE_LIMIT_MAX, API_READ_RATE_LIMIT_WINDOW);
const deleteLimiter = createLimiter(
	'rl:retrieval:documents:delete',
	API_WRITE_RATE_LIMIT_MAX,
	API_WRITE_RATE_LIMIT_WINDOW,
);

export const GET: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiUser(locals);

	const { success, reset } = await readLimiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	try {
		const doc = await getDocument(params.id, user.id);
		if (!doc) return apiError(404, 'not_found', 'Document not found.');
		return apiOk({ document: doc });
	} catch (err) {
		console.error('[api:retrieval:documents] Error:', err instanceof Error ? err.message : err);
		return apiError(500, 'fetch_failed', 'Failed to fetch document.');
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiUser(locals);

	const { success, reset } = await deleteLimiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	try {
		const deleted = await deleteDocument(params.id, user.id);
		if (!deleted) return apiError(404, 'not_found', 'Document not found.');

		// Clean up graph data (non-critical)
		try {
			await deleteDocumentGraph(params.id);
		} catch (graphErr) {
			console.error(
				'[api:retrieval:documents] Graph cleanup failed:',
				graphErr instanceof Error ? graphErr.message : graphErr,
			);
		}

		return apiNoContent();
	} catch (err) {
		console.error('[api:retrieval:documents] Error:', err instanceof Error ? err.message : err);
		return apiError(500, 'delete_failed', 'Failed to delete document.');
	}
};
