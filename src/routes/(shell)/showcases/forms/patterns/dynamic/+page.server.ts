import { fail, message, superValidate } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { dynamicSchema } from '$lib/schemas/showcase/patterns';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const form = await superValidate({ title: '', tags: [] as string[] }, valibot(dynamicSchema));
	return { form };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await superValidate(request, valibot(dynamicSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		const tags = form.data.tags;
		return message(
			form,
			`Saved "${form.data.title}" with ${tags.length} tag${tags.length !== 1 ? 's' : ''}: ${tags.join(', ')}.`,
		);
	},
};
