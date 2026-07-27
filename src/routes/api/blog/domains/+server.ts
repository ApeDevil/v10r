import { apiPaginated, parsePagination } from '$lib/server/api/pagination';
import { guardApiBlogAuthor } from '$lib/server/auth/guards';
import { listDomains } from '$lib/server/blog';
import type { RequestHandler } from './$types';

/** List all domains (for the metadata drawer domain picker). */
export const GET: RequestHandler = async ({ url, locals }) => {
	const guard = guardApiBlogAuthor(locals);
	if ('error' in guard) return guard.error;
	const pagination = parsePagination(url);
	const { items, total } = await listDomains(pagination.offset, pagination.pageSize);
	return apiPaginated(items, total, pagination);
};
