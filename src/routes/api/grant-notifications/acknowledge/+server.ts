import * as v from 'valibot';
import { acknowledgeGrantNotifications, GRANT_KINDS } from '#lib/server/auth/grants.ts';
import { guardApiUser } from '#lib/server/http/guards.ts';
import { createLimiter, rateLimitResponse } from '#lib/server/http/rate-limit.ts';
import { apiError, apiNoContent, apiValidationError } from '#lib/server/http/response.ts';
import type { RequestHandler } from './$types';

const limiter = createLimiter('ratelimit:grant-notification-ack:user', 20, '1 m');

const acknowledgeInputSchema = v.object({
	kinds: v.pipe(v.array(v.picklist(GRANT_KINDS)), v.minLength(1), v.maxLength(GRANT_KINDS.length)),
});

/**
 * Mark the "you now have X access" Toast as seen. The /desk layout calls this after it
 * showed the Toast — never the load, which also runs on link-hover preload. Idempotent:
 * re-acknowledging, or acknowledging a kind with nothing pending, answers 204 too.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Request body must be valid JSON.');

	const parsed = v.safeParse(acknowledgeInputSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	await acknowledgeGrantNotifications(user.id, parsed.output.kinds);
	return apiNoContent();
};
