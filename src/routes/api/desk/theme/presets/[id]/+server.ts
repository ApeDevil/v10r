import { requireApiUser } from '$lib/server/auth/guards';
import { deleteDeskPreset } from '$lib/server/desk';
import { apiNoContent, apiError } from '$lib/server/api/response';
import type { RequestHandler } from './$types';

/** Delete a user preset. */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiUser(locals);

	const deleted = await deleteDeskPreset(params.id, user.id);
	if (!deleted) return apiError(404, 'not_found', 'Preset not found');

	return apiNoContent();
};
