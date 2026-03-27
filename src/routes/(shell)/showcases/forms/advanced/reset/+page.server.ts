import { fail, message, superValidate } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { feedbackSchema } from '$lib/schemas/showcase/advanced';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const form = await superValidate({ rating: 3, comment: '', recommend: false }, valibot(feedbackSchema));
	return { form };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await superValidate(request, valibot(feedbackSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		await new Promise((r) => setTimeout(r, 300));

		return message(form, 'Thank you for your feedback!');
	},
};
