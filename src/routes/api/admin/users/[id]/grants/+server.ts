import { listGrantsForUser } from '$lib/server/auth/grants';
import { guardApiAdmin } from '$lib/server/http/guards';
import { apiOk } from '$lib/server/http/response';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const guard = guardApiAdmin(locals);
	if ('error' in guard) return guard.error;

	const items = await listGrantsForUser(params.id);
	return apiOk({ items });
};
