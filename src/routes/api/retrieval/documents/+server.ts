import { apiPaginated, parsePagination } from '$lib/server/api/pagination';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import { API_READ_RATE_LIMIT_MAX, API_READ_RATE_LIMIT_WINDOW } from '$lib/server/config';
import { listDocuments } from '$lib/server/db/rag/queries';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:retrieval:documents', API_READ_RATE_LIMIT_MAX, API_READ_RATE_LIMIT_WINDOW);

export const GET: RequestHandler = async ({ url, locals }) => {
	const { user } = requireApiUser(locals);

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	try {
		const pagination = parsePagination(url);
		const { items, total } = await listDocuments(user.id, pagination.offset, pagination.pageSize);
		return apiPaginated(items, total, pagination);
	} catch (err) {
		console.error('[api:retrieval:documents] Error:', err instanceof Error ? err.message : err);
		return apiError(500, 'list_failed', 'Failed to list documents.');
	}
};
