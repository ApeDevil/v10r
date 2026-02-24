import type { PageServerLoad, Actions } from './$types';
import { superValidate, fail, message } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { settingsSchema } from '$lib/schemas/forms-showcase/basics';

const mockSettings = {
	displayName: 'Jane Doe',
	email: 'jane@example.com',
	website: 'https://janedoe.dev',
	timezone: 'utc',
	language: 'en',
	emailNotifications: true,
	marketingEmails: false,
	publicProfile: true,
};

export const load: PageServerLoad = async () => {
	const form = await superValidate(mockSettings, valibot(settingsSchema));
	return { form };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await superValidate(request, valibot(settingsSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		await new Promise((r) => setTimeout(r, 300));

		return message(form, 'Settings saved successfully.');
	},
};
