import * as v from 'valibot';
import { apiError, apiOk, apiValidationError } from '$lib/server/api/response';
import { denyRequest } from '$lib/server/auth/grant-requests';
import { guardApiAdmin } from '$lib/server/auth/guards';
import type { RequestHandler } from './$types';

const denyInputSchema = v.object({
	reason: v.optional(v.pipe(v.string(), v.maxLength(500))),
});

export const POST: RequestHandler = async ({ request, params, locals }) => {
	const guard = guardApiAdmin(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const body = await request.json().catch(() => ({}));
	const parsed = v.safeParse(denyInputSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	try {
		await denyRequest({
			requestId: params.id,
			actor: { id: user.id, email: user.email },
			reason: parsed.output.reason,
			ipAddress: locals.clientIp,
		});
		return apiOk({ id: params.id, status: 'denied' });
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		if (msg.includes('already resolved') || msg.includes('not found')) {
			return apiError(409, 'grant_request_already_resolved', 'Request not found or already resolved');
		}
		throw err;
	}
};
