import { fail, message, superValidate } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { draftMessageSchema } from '$lib/schemas/showcase/advanced';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const form = await superValidate(valibot(draftMessageSchema));
	return { title: 'Draft - Advanced - Showcases', form };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await superValidate(request, valibot(draftMessageSchema));
		if (!form.valid) return fail(400, { form });
		// Nothing is sent anywhere: the showcase only proves the draft is cleared on success.
		return message(form, 'sent');
	},
};
