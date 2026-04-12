import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError, apiNoContent } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import { deleteDeskPreset } from '$lib/server/desk';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:desk:theme:presets', 30, '1 m');

/** Delete a user preset. */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiUser(locals);

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const deleted = await deleteDeskPreset(params.id, user.id);
	if (!deleted) return apiError(404, 'not_found', 'Preset not found');

	return apiNoContent();
};
