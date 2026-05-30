import { apiOk } from '$lib/server/api/response';
import { listGrantsForUser } from '$lib/server/auth/grants';
import { guardApiAdmin } from '$lib/server/auth/guards';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const guard = guardApiAdmin(locals);
	if ('error' in guard) return guard.error;

	const items = await listGrantsForUser(params.id);
	return apiOk({ items });
};
