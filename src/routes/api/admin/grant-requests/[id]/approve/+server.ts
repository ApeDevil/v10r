import { approveRequest } from '$lib/server/auth/grant-requests';
import { guardApiAdmin } from '$lib/server/http/guards';
import { apiError, apiOk } from '$lib/server/http/response';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals }) => {
	const guard = guardApiAdmin(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	try {
		await approveRequest({
			requestId: params.id,
			actor: { id: user.id, email: user.email },
			ipAddress: locals.clientIp,
		});
		return apiOk({ id: params.id, status: 'approved' });
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		if (msg.includes('already resolved') || msg.includes('not found')) {
			return apiError(409, 'grant_request_already_resolved', 'Request not found or already resolved');
		}
		throw err;
	}
};
