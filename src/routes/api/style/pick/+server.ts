/**
 * POST /api/style/pick — Apply a specific style choice.
 *
 * The sibling `roll` endpoint randomizes all three dimensions at once. This one
 * sets whichever dimensions the caller names and leaves the rest alone, which is
 * what the public style picker on /showcases/shell/style needs.
 *
 * Open to anonymous visitors by design — picking writes only the caller's own
 * `v10r_style` cookie. The one exception is a custom (`CP_`) palette, which
 * requires a session and ownership; see the note on that branch below.
 */

import * as v from 'valibot';
import { StylePickSchema } from '$lib/schemas/style';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError, apiOk, apiValidationError } from '$lib/server/api/response';
import { getCustomPaletteById } from '$lib/server/branding/palette-crud';
import {
	STYLE_PICK_RATE_LIMIT_MAX,
	STYLE_PICK_RATE_LIMIT_PREFIX,
	STYLE_PICK_RATE_LIMIT_WINDOW,
} from '$lib/server/config';
import { saveStyleToDb } from '$lib/server/style/persist';
import {
	generateRandomStyle,
	getRadius,
	getTypography,
	parseStyleCookie,
	resolveStyle,
	STYLE_COOKIE_NAME,
	STYLE_COOKIE_OPTIONS,
	serializeStyleCookie,
} from '$lib/styles/random';
import { mergeStyleConfig } from '$lib/styles/random/merge';
import type { RequestHandler } from './$types';

const limiter = createLimiter(STYLE_PICK_RATE_LIMIT_PREFIX, STYLE_PICK_RATE_LIMIT_MAX, STYLE_PICK_RATE_LIMIT_WINDOW);

export const POST: RequestHandler = async ({ request, cookies, locals, getClientAddress }) => {
	// Key per user when we have one so a shared NAT can't lock out a room of
	// guests. Fall back to the canonical stamped IP, never a raw header read.
	const key = locals.user?.id ?? locals.clientIp ?? getClientAddress();
	const { success, reset } = await limiter.limit(key);
	if (!success) return rateLimitResponse(reset);

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return apiError(400, 'invalid_body', 'Expected a JSON body.');
	}

	const parsed = v.safeParse(StylePickSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	// locals.style is unavailable here — loadStyle returns early for /api/ paths.
	// Falling back to a random config rather than a hardcoded default stops a
	// first pick from a cookie-less visitor silently pinning the other two
	// dimensions to whatever we happened to hardcode.
	const base = parseStyleCookie(cookies.get(STYLE_COOKIE_NAME)) ?? generateRandomStyle();
	const next = mergeStyleConfig(base, parsed.output);

	const typography = getTypography(next.typographyId);
	const radius = getRadius(next.radiusId);
	if (!typography || !radius) return apiError(500, 'resolve_failed', 'Failed to resolve style.');

	// resolveStyle() returns null for a CP_ palette (the registry has no entry),
	// so the two branches assemble the palette name differently — as loadStyle does.
	let paletteName: string;

	if (next.paletteId.startsWith('CP_')) {
		// Custom palettes are globally readable by id — loadStyle runs before
		// sessionPopulate and so structurally cannot know the user, and that
		// asymmetry is load-bearing for SSR. But this endpoint echoes the palette
		// *name*, which is user-authored text, so leaving it open would build a
		// `CP_id -> name` oracle the cookie path never exposed. Gate it instead,
		// keeping the anonymous surface of this endpoint entirely DB-free.
		if (!locals.user) return apiError(401, 'unauthorized', 'Sign in to use a custom palette.');

		const cp = await getCustomPaletteById(next.paletteId);
		// Not-found and not-yours are deliberately indistinguishable.
		if (!cp || cp.createdBy !== locals.user.id) return apiError(404, 'not_found', 'Palette not found.');

		paletteName = cp.name;
	} else {
		const resolved = resolveStyle(next);
		if (!resolved) return apiError(500, 'resolve_failed', 'Failed to resolve style.');
		paletteName = resolved.paletteName;
	}

	cookies.set(STYLE_COOKIE_NAME, serializeStyleCookie(next), STYLE_COOKIE_OPTIONS);

	// Fire-and-forget DB persistence for authenticated users, as in roll.
	if (locals.user) {
		saveStyleToDb(locals.user.id, next).catch(() => {});
	}

	return apiOk({
		style: {
			paletteId: next.paletteId,
			typographyId: next.typographyId,
			radiusId: next.radiusId,
			paletteName,
			typographyName: typography.name,
			radiusName: radius.name,
		},
	});
};
