/**
 * POST /api/style/roll — Generate a new random style.
 * Sets cookie and fire-and-forget DB persistence for auth users.
 */

import { ipLimitKey } from '$lib/server/abuse';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiError, apiOk } from '$lib/server/http/response';
import { ROLL_RATE_LIMIT_MAX, ROLL_RATE_LIMIT_PREFIX, ROLL_RATE_LIMIT_WINDOW } from '$lib/server/style/config';
import { saveStyleToDb } from '$lib/server/style/persist';
import {
	generateRandomStyle,
	parseStyleCookie,
	resolveStyle,
	STYLE_COOKIE_NAME,
	STYLE_COOKIE_OPTIONS,
	serializeStyleCookie,
} from '$lib/styles/random';
import type { PaletteId, RadiusId, TypographyId } from '$lib/styles/random/types';
import type { RequestHandler } from './$types';

const limiter = createLimiter(ROLL_RATE_LIMIT_PREFIX, ROLL_RATE_LIMIT_MAX, ROLL_RATE_LIMIT_WINDOW);

export const POST: RequestHandler = async ({ cookies, locals, getClientAddress }) => {
	// Key on the canonical stamped IP (locals.clientIp), not a raw header read, to
	// avoid a rate-limit bypass vector. Fallback to getClientAddress() only if unset.
	const { success, reset } = await limiter.limit(ipLimitKey(locals.clientIp ?? getClientAddress()));

	if (!success) {
		return rateLimitResponse(reset);
	}

	// Read current style to exclude from re-roll
	const current = parseStyleCookie(cookies.get(STYLE_COOKIE_NAME));

	const excludePaletteIds: PaletteId[] = current ? [current.paletteId] : [];
	const excludeTypographyIds: TypographyId[] = current ? [current.typographyId] : [];
	const excludeRadiusIds: RadiusId[] = current ? [current.radiusId] : [];

	const config = generateRandomStyle({ excludePaletteIds, excludeTypographyIds, excludeRadiusIds });
	const resolved = resolveStyle(config);

	if (!resolved) {
		return apiError(500, 'resolve_failed', 'Failed to resolve style.');
	}

	cookies.set(STYLE_COOKIE_NAME, serializeStyleCookie(config), STYLE_COOKIE_OPTIONS);

	// Fire-and-forget DB persistence for authenticated users
	if (locals.user) {
		saveStyleToDb(locals.user.id, config).catch(() => {});
	}

	return apiOk({
		style: {
			paletteId: resolved.paletteId,
			typographyId: resolved.typographyId,
			radiusId: resolved.radiusId,
			paletteName: resolved.paletteName,
			typographyName: resolved.typographyName,
			radiusName: resolved.radiusName,
		},
	});
};
