import { fail, message, superValidate } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { contactSchema } from '$lib/schemas/showcase/basics';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const form = await superValidate(valibot(contactSchema));
	return { form };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await superValidate(request, valibot(contactSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		// Simulate server processing delay
		await new Promise((r) => setTimeout(r, 500));

		return message(form, `Thanks ${form.data.name}! Your message has been sent.`);
	},
};
