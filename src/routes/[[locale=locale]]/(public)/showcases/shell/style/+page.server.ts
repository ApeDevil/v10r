import { listCustomPalettes } from '$lib/server/style';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// /showcases/** is fully public — the only hooks-level guard is devRouteGuard.
	// NEVER call requireAuth/requireAdmin here: requireAdmin calls requireAuth
	// first, which redirects anonymous visitors to /auth/login and would turn this
	// showcase into a login wall. Branch on locals.user instead.
	const rows = locals.user ? await listCustomPalettes(locals.user.id) : [];

	return {
		title: 'Style - Shell - Showcases',
		// The visitor's own palettes, colors included so the workshop can open one
		// without a round-trip. Ownership columns are projected out.
		customPalettes: rows.map((p) => ({
			id: p.id,
			name: p.name,
			description: p.description,
			basePaletteId: p.basePaletteId,
			lightColors: p.lightColors,
			darkColors: p.darkColors,
		})),
	};
};
