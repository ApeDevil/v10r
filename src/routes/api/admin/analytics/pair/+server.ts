/**
 * Admin pairing endpoint — generate a pairing code (+ its QR) for the current admin.
 */

import { requireAdmin } from '$lib/server/http/guards';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiCreated, apiError } from '$lib/server/http/response';
import { createPairingCode, qrSvg } from '$lib/server/pairing';
import type { RequestHandler } from './$types';

const generateLimit = createLimiter('rl:pair:generate', 5, '60 s');

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
