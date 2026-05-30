import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError, apiNoContent, apiOk } from '$lib/server/api/response';
import { GRANT_KINDS, type GrantKind, grantCapability, revokeCapability } from '$lib/server/auth/grants';
import { guardApiAdmin } from '$lib/server/auth/guards';
import type { RequestHandler } from './$types';

const adminGrantLimit = createLimiter('ratelimit:admin-grant', 30, '1 m');

function parseKind(value: string): GrantKind | null {
	return (GRANT_KINDS as readonly string[]).includes(value) ? (value as GrantKind) : null;
}

/** Idempotent grant. */
export const PUT: RequestHandler = async ({ params, locals }) => {
	const guard = guardApiAdmin(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await adminGrantLimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const kind = parseKind(params.kind);
	if (!kind) return apiError(422, 'invalid_kind', 'Unknown grant kind');

	await grantCapability({
		userId: params.id,
		kind,
		actor: { id: user.id, email: user.email },
		ipAddress: locals.clientIp,
	});

	return apiOk({ userId: params.id, kind, status: 'granted' });
};

/** Soft revoke. */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const guard = guardApiAdmin(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await adminGrantLimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const kind = parseKind(params.kind);
	if (!kind) return apiError(422, 'invalid_kind', 'Unknown grant kind');

	await revokeCapability({
		userId: params.id,
		kind,
		actor: { id: user.id, email: user.email },
		ipAddress: locals.clientIp,
	});

	return apiNoContent();
};
