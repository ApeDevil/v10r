import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { cycleSchema } from '$lib/schemas/showcase/cycle';
import { executeCycle } from '$lib/server/cycle';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const form = await superValidate(valibot(cycleSchema));
	return { form };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await superValidate(request, valibot(cycleSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		const result = await executeCycle(form.data, 'form');

		return { form, trace: result.trace, success: result.success, error: result.error };
	},
};
