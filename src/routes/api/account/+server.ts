/**
 * DELETE /api/account — full account erasure (GDPR Art 17).
 * Idempotent: deleting an already-deleted user returns 204, not an error.
 * Delegates to the same deleteUserData as the account page's typed-confirmation
 * form action — one definition of "delete everything".
 *
 * 409 `sole_admin_blocked` when the caller is the last configured admin and owns
 * posts/grants that have nobody to be reassigned to.
 */

import { guardApiUser } from '$lib/server/http/guards';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiError, apiNoContent } from '$lib/server/http/response';
import { deleteUserData, SoleAdminBlockedError } from '$lib/server/privacy';
import type { RequestHandler } from './$types';

const ratelimit = createLimiter('rl:me-delete', 3, '1m');

export const DELETE: RequestHandler = async ({ locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await ratelimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	try {
		await deleteUserData(user.id);
	} catch (err) {
		// Refusal, not failure: the account is intact and the operator can unblock it by
		// configuring a second admin. Anything else is a genuine 500 and keeps propagating.
		if (err instanceof SoleAdminBlockedError) return apiError(409, err.code, err.message);
		throw err;
	}
	return apiNoContent();
};
