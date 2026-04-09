import { apiOk } from '$lib/server/api/response';
import { requireApiAuthor } from '$lib/server/auth/guards';
import { listDomains } from '$lib/server/blog';
import type { RequestHandler } from './$types';

/** List all domains (for the metadata drawer domain picker). */
export const GET: RequestHandler = async ({ locals }) => {
	requireApiAuthor(locals);
	const domains = await listDomains();
	return apiOk({ domains });
};
