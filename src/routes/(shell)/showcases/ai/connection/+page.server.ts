import { redirect } from '@sveltejs/kit';
import { getProviderStatuses, verifyAIConnection } from '$lib/server/ai/showcase/queries';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		redirect(303, '/auth/login');
	}

	const connection = await verifyAIConnection();
	const providers = getProviderStatuses();

	return {
		connection,
		providers,
		measuredAt: new Date().toISOString(),
	};
};

export const actions: Actions = {
	retest: async ({ locals }) => {
		if (!locals.user) {
			redirect(303, '/auth/login');
		}

		await verifyAIConnection();
		// Load re-runs via update() in the enhance callback — no return needed
	},
};
