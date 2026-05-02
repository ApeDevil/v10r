/**
 * Admin revokes one of their own pairing codes / paired sessions.
 */
import { apiError, apiNoContent } from '$lib/server/api/response';
import { requireAdmin } from '$lib/server/auth/guards';
import { revokePairing } from '$lib/server/pairing';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ locals, params, request }) => {
	const { user } = requireAdmin(locals);

	if (!request.headers.get('x-requested-with')) {
		return apiError(403, 'forbidden', 'CSRF token required.');
	}

	const code = params.code;
	if (!code || !/^[2-9]{6}$/.test(code)) {
		return apiError(400, 'invalid_code', 'Bad code format.');
	}

	const ok = await revokePairing(code, user.id);
	if (!ok) return apiError(404, 'not_found', 'No active pairing for that code.');

	return apiNoContent();
};
