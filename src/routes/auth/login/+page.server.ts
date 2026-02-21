import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	// Already logged in → redirect to returnTo or dashboard
	if (locals.user) {
		const returnTo = url.searchParams.get('returnTo') || '/app/dashboard';
		redirect(303, returnTo);
	}

	return {
		returnTo: url.searchParams.get('returnTo') || '/app/dashboard',
	};
};
