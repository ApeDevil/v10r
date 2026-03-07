import type { PageServerLoad, Actions } from './$types';
import { superValidate, fail, message } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { profileEditSchema } from '$lib/schemas/showcase/advanced';

const mockProfile = {
	name: 'Jane Doe',
	email: 'jane@example.com',
	role: 'admin',
	bio: 'Full-stack developer with a passion for clean architecture.',
	active: true,
};

export const load: PageServerLoad = async () => {
	const form = await superValidate(mockProfile, valibot(profileEditSchema));
	return { form };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await superValidate(request, valibot(profileEditSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		await new Promise((r) => setTimeout(r, 300));

		return message(form, `Profile updated for ${form.data.name}.`);
	},
};
