import { fail, message, superValidate } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { settingsSchema } from '$lib/schemas/showcase/basics';
import type { Actions, PageServerLoad } from './$types';

const mockSettings = {
	displayName: 'Jane Doe',
	email: 'jane@example.com',
	website: 'https://janedoe.dev',
	timezone: 'utc' as const,
	language: 'en' as const,
	emailNotifications: true,
	marketingEmails: false,
	publicProfile: true,
};

export const load: PageServerLoad = async () => {
	const form = await superValidate(mockSettings, valibot(settingsSchema));
	return { title: 'Settings - Basics - Showcases', form };
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
