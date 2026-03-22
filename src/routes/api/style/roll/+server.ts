/**
 * POST /api/style/roll — Generate a new random style.
 * Sets cookie and fire-and-forget DB persistence for auth users.
 */

import { json } from '@sveltejs/kit';
import { getBrandConfig } from '$lib/server/style/brand';
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

export const POST: RequestHandler = async ({ cookies, locals }) => {
	// Read current style to exclude from re-roll
	const current = parseStyleCookie(cookies.get(STYLE_COOKIE_NAME));

	// Reject if visual identity is locked
	const brand = await getBrandConfig();
	if (brand?.enabled) {
		return json({ error: 'Visual identity is locked' }, { status: 409 });
	}

	const excludePaletteIds: PaletteId[] = current ? [current.paletteId] : [];
	const excludeTypographyIds: TypographyId[] = current ? [current.typographyId] : [];
	const excludeRadiusIds: RadiusId[] = current ? [current.radiusId] : [];

	const config = generateRandomStyle({ excludePaletteIds, excludeTypographyIds, excludeRadiusIds });
	const resolved = resolveStyle(config);

	if (!resolved) {
		return json({ error: 'Failed to resolve style' }, { status: 500 });
	}

	// Set cookie
	cookies.set(STYLE_COOKIE_NAME, serializeStyleCookie(config), STYLE_COOKIE_OPTIONS);

	// Fire-and-forget DB persistence for authenticated users
	if (locals.user) {
		saveStyleToDb(locals.user.id, config).catch(() => {});
	}

	return json({
		success: true,
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
