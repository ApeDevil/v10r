/**
 * PATCH|DELETE /api/style/palettes/[id] — Update or remove your own palette.
 *
 * Ownership is enforced inside palette-crud: both statements carry an
 * `AND created_by = :userId` predicate, so a mismatched id simply affects no
 * rows and returns null. That collapses "doesn't exist" and "isn't yours" into
 * one 404, which is what we want — neither is a fact worth confirming.
 */

import * as v from 'valibot';
import { customPaletteSchema } from '$lib/schemas/app/branding';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError, apiNoContent, apiOk, apiValidationError } from '$lib/server/api/response';
import { guardApiUser } from '$lib/server/auth/guards';
import { deleteCustomPalette, updateCustomPalette } from '$lib/server/branding/palette-crud';
import {
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

export const PATCH: RequestHandler = async ({ request, params, locals }) => {
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

	const updated = await updateCustomPalette(params.id, user.id, {
		name: parsed.output.name,
		description: parsed.output.description ?? '',
		lightColors: parsed.output.lightColors,
		darkColors: parsed.output.darkColors,
	});
	if (!updated) return apiError(404, 'not_found', 'Palette not found.');

	return apiOk({
		palette: {
			id: updated.id,
			name: updated.name,
			description: updated.description,
			basePaletteId: updated.basePaletteId,
			lightColors: updated.lightColors,
			darkColors: updated.darkColors,
		},
	});
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const deleted = await deleteCustomPalette(params.id, user.id);
	if (!deleted) return apiError(404, 'not_found', 'Palette not found.');

	return apiNoContent();
};
