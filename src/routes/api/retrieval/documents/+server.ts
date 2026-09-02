import { listDocuments } from '$lib/server/db/retrieval/queries';
import { READ_RATE_LIMIT_MAX, READ_RATE_LIMIT_WINDOW } from '$lib/server/http/config';
import { guardApiUser } from '$lib/server/http/guards';
import { apiPaginated, parsePagination } from '$lib/server/http/pagination';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiError } from '$lib/server/http/response';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:retrieval:documents', READ_RATE_LIMIT_MAX, READ_RATE_LIMIT_WINDOW);

export const GET: RequestHandler = async ({ url, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

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
