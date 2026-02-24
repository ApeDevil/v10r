import type { PageServerLoad, Actions } from './$types';
import { superValidate, fail, message } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { dynamicSchema } from '$lib/schemas/forms-showcase/patterns';

export const load: PageServerLoad = async () => {
	const form = await superValidate(
		{ title: '', tags: [{ name: '' }] },
		valibot(dynamicSchema)
	);
	return { form };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await superValidate(request, valibot(dynamicSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		const tagCount = form.data.tags.length;
		return message(form, `Saved "${form.data.title}" with ${tagCount} tag${tagCount !== 1 ? 's' : ''}.`);
	},
};
