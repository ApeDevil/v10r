/**
 * DELETE /api/me — full account erasure (GDPR Art 17).
 * Idempotent: deleting an already-deleted user returns 204, not an error.
 * Delegates to the same deleteUserData as the account page's typed-confirmation
 * form action — one definition of "delete everything".
 */
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiNoContent } from '$lib/server/api/response';
import { guardApiUser } from '$lib/server/auth/guards';
import { deleteUserData } from '$lib/server/privacy';
import type { RequestHandler } from './$types';

const ratelimit = createLimiter('rl:me-delete', 3, '1m');

export const DELETE: RequestHandler = async ({ locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await ratelimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	await deleteUserData(user.id);
	return apiNoContent();
};
