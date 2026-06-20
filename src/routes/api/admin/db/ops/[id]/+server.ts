import { apiError, apiOk } from '$lib/server/api/response';
import { guardApiAdmin } from '$lib/server/auth/guards';
import { getRun } from '$lib/server/dbops';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const guard = guardApiAdmin(event.locals);
	if ('error' in guard) return guard.error;

	const run = await getRun(event.params.id);
	if (!run) return apiError(404, 'not_found', 'Run not found');
	return apiOk(run);
};
