import { listTags } from '#lib/server/blog/index.ts';
import { guardApiBlogAuthor } from '#lib/server/http/guards.ts';
import { apiPaginated, parsePagination } from '#lib/server/http/pagination.ts';
import type { RequestHandler } from './$types';

/** List all tags (for the metadata drawer tag picker). */
export const GET: RequestHandler = async ({ url, locals }) => {
	const guard = guardApiBlogAuthor(locals);
	if ('error' in guard) return guard.error;
	const pagination = parsePagination(url);
	const { items, total } = await listTags(pagination.offset, pagination.pageSize);
	return apiPaginated(items, total, pagination);
};
