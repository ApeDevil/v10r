import { advanceOperation } from '$lib/server/dbops';
import { guardApiAdmin } from '$lib/server/http/guards';
import { apiError, apiOk } from '$lib/server/http/response';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const guard = guardApiAdmin(event.locals);
	if ('error' in guard) return guard.error;

	const operation = await advanceOperation(event.params.id);
	if (!operation) return apiError(404, 'not_found', 'Operation not found');
	return apiOk(operation);
};
