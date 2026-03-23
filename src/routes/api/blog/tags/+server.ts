import { json } from '@sveltejs/kit';
import { requireApiAuthor } from '$lib/server/auth/guards';
import { listTags } from '$lib/server/blog';
import type { RequestHandler } from './$types';

/** List all tags (for the metadata drawer tag picker). */
export const GET: RequestHandler = async ({ locals }) => {
	requireApiAuthor(locals);
	const tags = await listTags();
	return json(tags);
};
