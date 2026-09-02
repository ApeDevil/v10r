import * as v from 'valibot';
import { env } from '$env/dynamic/private';
import { createPushSubscription, deletePushSubscription } from '$lib/server/db/notifications/mutations';
import { guardApiUser } from '$lib/server/http/guards';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiError, apiOk } from '$lib/server/http/response';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:notifications:push', 10, '1 m');

const subscribeSchema = v.object({
	endpoint: v.pipe(v.string(), v.url(), v.startsWith('https://')),
	keys: v.object({
		p256dh: v.pipe(v.string(), v.minLength(1), v.maxLength(512)),
		auth: v.pipe(v.string(), v.minLength(1), v.maxLength(256)),
	}),
});

const unsubscribeSchema = v.object({
	endpoint: v.pipe(v.string(), v.url(), v.startsWith('https://')),
});

/** Public VAPID key for the client's pushManager.subscribe(). */
export const GET: RequestHandler = async ({ locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;

	const publicKey = env.VAPID_PUBLIC_KEY;
	if (!publicKey) return apiError(503, 'unavailable', 'Push not configured');

	return apiOk({ publicKey });
};

/** Register this device's push subscription (session-authenticated). */
export const POST: RequestHandler = async ({ request, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const parsed = v.safeParse(subscribeSchema, await request.json().catch(() => null));
	if (!parsed.success) return apiError(400, 'invalid_subscription', 'Invalid push subscription payload');

	await createPushSubscription(user.id, {
		endpoint: parsed.output.endpoint,
		p256dh: parsed.output.keys.p256dh,
		auth: parsed.output.keys.auth,
		userAgent: request.headers.get('user-agent'),
	});

	return apiOk({ subscribed: true });
};

/** Remove this device's subscription (sign-out hygiene / toggle off). */
export const DELETE: RequestHandler = async ({ request, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const parsed = v.safeParse(unsubscribeSchema, await request.json().catch(() => null));
	if (!parsed.success) return apiError(400, 'invalid_subscription', 'Invalid unsubscribe payload');

	const removed = await deletePushSubscription(user.id, parsed.output.endpoint);
	return apiOk({ removed });
};
