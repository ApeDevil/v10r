import { deleteDocument } from '#lib/server/db/retrieval/mutations.ts';
import { getDocument } from '#lib/server/db/retrieval/queries.ts';
import { deleteDocumentGraph } from '#lib/server/graph/retrieval/mutations.ts';
import {
	READ_RATE_LIMIT_MAX,
	READ_RATE_LIMIT_WINDOW,
	WRITE_RATE_LIMIT_MAX,
	WRITE_RATE_LIMIT_WINDOW,
} from '#lib/server/http/config.ts';
import { guardApiUser } from '#lib/server/http/guards.ts';
import { createLimiter, rateLimitResponse } from '#lib/server/http/rate-limit.ts';
import { apiError, apiNoContent, apiOk } from '#lib/server/http/response.ts';
import type { RequestHandler } from './$types';

const readLimiter = createLimiter('rl:retrieval:documents:read', READ_RATE_LIMIT_MAX, READ_RATE_LIMIT_WINDOW);
const deleteLimiter = createLimiter('rl:retrieval:documents:delete', WRITE_RATE_LIMIT_MAX, WRITE_RATE_LIMIT_WINDOW);

export const GET: RequestHandler = async ({ params, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

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
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await deleteLimiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	try {
		const deleted = await deleteDocument(params.id, user.id);
		if (!deleted) return apiError(404, 'not_found', 'Document not found.');

		// Clean up graph data (non-critical), scoped to the owner.
		try {
			await deleteDocumentGraph(params.id, user.id);
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
