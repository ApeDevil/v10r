import type { PageServerLoad, Actions } from './$types';
import { superValidate, fail, message } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { wizardSchema } from '$lib/schemas/showcase/patterns';

export const load: PageServerLoad = async () => {
	const form = await superValidate(valibot(wizardSchema));
	return { form };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await superValidate(request, valibot(wizardSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		await new Promise((r) => setTimeout(r, 500));

		return message(form, `Welcome ${form.data.firstName}! Your ${form.data.plan} plan is set up.`);
	},
};
