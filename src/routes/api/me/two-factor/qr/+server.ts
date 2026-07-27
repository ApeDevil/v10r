/**
 * POST /api/me/two-factor/qr — render the caller's TOTP enrollment URI as an
 * SVG QR code. The otpauth:// URI only exists client-side (returned by the
 * twoFactor enable call), while QR generation lives server-side (qrcode dep) —
 * this endpoint bridges the two. The prefix check stops abuse as a generic
 * QR-rendering service; a user can only ever render a code for themselves.
 */
import * as v from 'valibot';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiOk, apiValidationError } from '$lib/server/api/response';
import { guardApiUser } from '$lib/server/auth/guards';
import { qrSvg } from '$lib/server/pairing/qr';
import type { RequestHandler } from './$types';

const ratelimit = createLimiter('rl:2fa-qr', 10, '1m');

const BodySchema = v.object({
	totpURI: v.pipe(v.string(), v.maxLength(1024), v.startsWith('otpauth://totp/')),
});

export const POST: RequestHandler = async ({ locals, request, setHeaders }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await ratelimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const parsed = v.safeParse(BodySchema, await request.json().catch(() => null));
	if (!parsed.success) return apiValidationError(parsed.issues);

	setHeaders({ 'Cache-Control': 'no-store, private' });

	return apiOk({ svg: await qrSvg(parsed.output.totpURI) });
};
