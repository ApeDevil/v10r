import { fail } from '@sveltejs/kit';
import { executeAiCycle } from '$lib/server/cycle';
import type { SimulateAiError } from '$lib/server/cycle/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({});

export const actions: Actions = {
	run: async ({ request, locals }) => {
		const userId = locals.user?.id ?? 'anonymous';
		const data = await request.formData();
		const query = String(data.get('query') ?? '').trim();
		const simulateError = (data.get('simulateError') as SimulateAiError) || undefined;

		if (!query) return fail(400, { error: 'Query is required' });

		const result = await executeAiCycle({ query, simulateError }, userId);
		return {
			trace: result.trace,
			success: result.success,
			error: result.error,
			answer: result.answer,
		};
	},
};
