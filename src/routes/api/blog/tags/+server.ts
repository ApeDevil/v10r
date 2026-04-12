import { apiPaginated, parsePagination } from '$lib/server/api/pagination';
import { requireApiAuthor } from '$lib/server/auth/guards';
import { listTags } from '$lib/server/blog';
import type { RequestHandler } from './$types';

/** List all tags (for the metadata drawer tag picker). */
export const GET: RequestHandler = async ({ url, locals }) => {
	requireApiAuthor(locals);
	const pagination = parsePagination(url);
	const { items, total } = await listTags(pagination.offset, pagination.pageSize);
	return apiPaginated(items, total, pagination);
};
