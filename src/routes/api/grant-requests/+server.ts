import * as v from 'valibot';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiCreated, apiError, apiOk, apiValidationError } from '$lib/server/api/response';
import {
	cancelMyPendingRequest,
	createGrantRequest,
	GrantRequestPendingError,
	listMyRequests,
} from '$lib/server/auth/grant-requests';
import { GRANT_KINDS } from '$lib/server/auth/grants';
import { guardApiUser } from '$lib/server/auth/guards';
import type { RequestHandler } from './$types';

const requestLimit = createLimiter('ratelimit:grant-request:user', 1, '24 h');

const requestInputSchema = v.object({
	kind: v.picklist(GRANT_KINDS),
	message: v.optional(v.pipe(v.string(), v.maxLength(500))),
});

const cancelInputSchema = v.object({
	kind: v.picklist(GRANT_KINDS),
});

export const POST: RequestHandler = async ({ request, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await requestLimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Request body must be valid JSON.');

	const parsed = v.safeParse(requestInputSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	try {
		const result = await createGrantRequest({
			userId: user.id,
			kind: parsed.output.kind,
			message: parsed.output.message,
		});
		return apiCreated({ id: result.id });
	} catch (err) {
		if (err instanceof GrantRequestPendingError) return apiError(409, err.code, err.message);
		throw err;
	}
};

export const GET: RequestHandler = async ({ locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const items = await listMyRequests(user.id);
	return apiOk({ items });
};

/** Cancel pending request. */
export const DELETE: RequestHandler = async ({ request, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const body = await request.json().catch(() => null);
	const parsed = v.safeParse(cancelInputSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	const cancelled = await cancelMyPendingRequest(user.id, parsed.output.kind);
	if (!cancelled) return apiError(404, 'not_found', 'No pending request to cancel.');
	return apiOk({ cancelled: true });
};
