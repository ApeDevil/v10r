import { apiPaginated, parsePagination } from '$lib/server/api/pagination';
import { requireApiAuthor } from '$lib/server/auth/guards';
import { listDomains } from '$lib/server/blog';
import type { RequestHandler } from './$types';

/** List all domains (for the metadata drawer domain picker). */
export const GET: RequestHandler = async ({ url, locals }) => {
	requireApiAuthor(locals);
	const pagination = parsePagination(url);
	const { items, total } = await listDomains(pagination.offset, pagination.pageSize);
	return apiPaginated(items, total, pagination);
};
