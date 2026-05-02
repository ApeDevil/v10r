/**
 * Phone-side: clear the debug-owner cookie. Holder of the cookie is the actor.
 * Requires X-Requested-With for parity with other mutations.
 */
import { apiError, apiNoContent } from '$lib/server/api/response';
import { clearOwnerCookie } from '$lib/server/pairing';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies, request }) => {
	if (!request.headers.get('x-requested-with')) {
		return apiError(403, 'forbidden', 'CSRF token required.');
	}
	clearOwnerCookie(cookies);
	return apiNoContent();
};
