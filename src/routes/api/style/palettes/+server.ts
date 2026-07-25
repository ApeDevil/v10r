/**
 * POST /api/style/palettes — Create a custom palette.
 *
 * Crafting a palette is open to everyone on the style showcase, but that work
 * lives in the browser until it is saved; persisting it needs an account. The
 * palette belongs to its creator — every read and write below is scoped by
 * `createdBy`.
 */

import * as v from 'valibot';
import { customPaletteSchema } from '$lib/schemas/app/branding';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiCreated, apiError, apiValidationError } from '$lib/server/api/response';
import { guardApiUser } from '$lib/server/auth/guards';
import { countCustomPalettes, createCustomPalette } from '$lib/server/branding/palette-crud';
import {
	MAX_CUSTOM_PALETTES_PER_USER,
	PALETTE_WRITE_RATE_LIMIT_MAX,
	PALETTE_WRITE_RATE_LIMIT_PREFIX,
	PALETTE_WRITE_RATE_LIMIT_WINDOW,
} from '$lib/server/config';
import type { RequestHandler } from './$types';

const limiter = createLimiter(
	PALETTE_WRITE_RATE_LIMIT_PREFIX,
	PALETTE_WRITE_RATE_LIMIT_MAX,
	PALETTE_WRITE_RATE_LIMIT_WINDOW,
);

export const POST: RequestHandler = async ({ request, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return apiError(400, 'invalid_body', 'Expected a JSON body.');
	}

	const parsed = v.safeParse(customPaletteSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	// Creation was admin-only until this endpoint existed, so it carried no cap.
	// Open to every account, it needs one.
	if ((await countCustomPalettes(user.id)) >= MAX_CUSTOM_PALETTES_PER_USER) {
		return apiError(
			409,
			'quota_exceeded',
			`You can keep up to ${MAX_CUSTOM_PALETTES_PER_USER} custom palettes. Delete one to make room.`,
		);
	}

	const palette = await createCustomPalette({
		name: parsed.output.name,
		description: parsed.output.description ?? '',
		basePaletteId: parsed.output.basePaletteId,
		lightColors: parsed.output.lightColors,
		darkColors: parsed.output.darkColors,
		createdBy: user.id,
	});

	return apiCreated({
		palette: {
			id: palette.id,
			name: palette.name,
			description: palette.description,
			basePaletteId: palette.basePaletteId,
			lightColors: palette.lightColors,
			darkColors: palette.darkColors,
		},
	});
};
