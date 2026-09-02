import { listPendingRequests } from '$lib/server/auth/grant-requests';
import { guardApiAdmin } from '$lib/server/http/guards';
import { apiOk } from '$lib/server/http/response';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const guard = guardApiAdmin(locals);
	if ('error' in guard) return guard.error;

	const items = await listPendingRequests();
	return apiOk({ items });
};
