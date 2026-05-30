import { apiOk } from '$lib/server/api/response';
import { listPendingRequests } from '$lib/server/auth/grant-requests';
import { guardApiAdmin } from '$lib/server/auth/guards';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const guard = guardApiAdmin(locals);
	if ('error' in guard) return guard.error;

	const items = await listPendingRequests();
	return apiOk({ items });
};
