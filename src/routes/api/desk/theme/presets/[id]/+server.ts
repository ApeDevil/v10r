import { deleteDeskPreset } from '$lib/server/desk';
import { guardApiUser } from '$lib/server/http/guards';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiError, apiNoContent } from '$lib/server/http/response';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:desk:theme:presets', 30, '1 m');

/** Delete a user preset. */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const deleted = await deleteDeskPreset(params.id, user.id);
	if (!deleted) return apiError(404, 'not_found', 'Preset not found');

	return apiNoContent();
};
