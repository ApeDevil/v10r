import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	// Defense-in-depth: hooks routeGuard already catches this,
	// but double-check in case route is accessed via preload
	if (!locals.user) {
		redirect(303, '/auth/login');
	}

	return {
		user: locals.user,
	};
};
