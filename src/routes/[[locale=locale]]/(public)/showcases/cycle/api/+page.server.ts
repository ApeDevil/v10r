import { executeCycle } from '$lib/server/cycle';
import type { SimulateError } from '$lib/server/cycle/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({});

export const actions: Actions = {
	run: async ({ request }) => {
		const data = await request.formData();
		const label = String(data.get('label') ?? 'API Call');
		const simulateError = (data.get('simulateError') as SimulateError) || undefined;

		const result = await executeCycle({ label, simulateError }, 'api');

		return {
			title: 'API Cycle - Request Cycle - Showcases',
			trace: result.trace,
			success: result.success,
			error: result.error,
		};
	},
};
