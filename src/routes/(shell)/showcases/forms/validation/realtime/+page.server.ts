import { fail, message, superValidate } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { realtimeSchema } from '$lib/schemas/showcase/validation';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const form = await superValidate(valibot(realtimeSchema));
	return { form };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await superValidate(request, valibot(realtimeSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		return message(form, `Account created for ${form.data.username}!`);
	},
};
