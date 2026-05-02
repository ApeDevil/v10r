/**
 * Admin pairing endpoints — generate a code (POST) or list active pairings (GET).
 */
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiCreated, apiError, apiOk } from '$lib/server/api/response';
import { requireAdmin } from '$lib/server/auth/guards';
import { createPairingCode, getActivePairings, qrSvg } from '$lib/server/pairing';
import type { RequestHandler } from './$types';

const generateLimit = createLimiter('rl:pair:generate', 5, '60 s');
const listLimit = createLimiter('rl:pair:list', 30, '60 s');

export const POST: RequestHandler = async ({ locals, url, request }) => {
	const { user } = requireAdmin(locals);

	const { success, reset } = await generateLimit.limit(user.id);
	if (!success) return rateLimitResponse(reset, 'Too many pairing attempts. Wait a moment.');

	if (!request.headers.get('x-requested-with')) {
		return apiError(403, 'forbidden', 'CSRF token required.');
	}

	try {
		const { code, expiresAt } = await createPairingCode(user.id);
		const pairUrl = `${url.origin}/pair/${code}`;
		const svg = await qrSvg(pairUrl);
		return apiCreated({
			code,
			expiresAt: expiresAt.toISOString(),
			pairUrl,
			qrSvg: svg,
		});
	} catch (err) {
		console.error('[pairing] createPairingCode failed', err);
		return apiError(500, 'internal', 'Failed to generate pairing code.');
	}
};

export const GET: RequestHandler = async ({ locals }) => {
	const { user } = requireAdmin(locals);

	const { success, reset } = await listLimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const pairings = await getActivePairings(user.id);
	return apiOk({
		pairings: pairings.map((p) => ({
			code: p.code,
			createdAt: p.createdAt.toISOString(),
			expiresAt: p.expiresAt.toISOString(),
			consumedAt: p.consumedAt?.toISOString() ?? null,
			pairedSessionId: p.pairedSessionId,
		})),
	});
};
