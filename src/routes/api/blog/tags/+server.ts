import { requireApiAuthor } from '$lib/server/auth/guards';
import { listTags } from '$lib/server/blog';
import { apiOk } from '$lib/server/api/response';
import type { RequestHandler } from './$types';

/** List all tags (for the metadata drawer tag picker). */
export const GET: RequestHandler = async ({ locals }) => {
	requireApiAuthor(locals);
	const tags = await listTags();
	return apiOk({ tags });
};
