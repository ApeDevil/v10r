import type { PageServerLoad, Actions } from './$types';
import { superValidate, fail, message } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { asyncSchema } from '$lib/schemas/showcase/validation';

export const load: PageServerLoad = async () => {
	const form = await superValidate(valibot(asyncSchema));
	return { form };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await superValidate(request, valibot(asyncSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		return message(form, `Registration submitted for ${form.data.username}.`);
	},
};
