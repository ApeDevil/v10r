import type { PageServerLoad, Actions } from './$types';
import { superValidate, fail, message } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { confirmSchema } from '$lib/schemas/showcase/advanced';

const mockItems = [
	{ id: 1, name: 'Project Alpha', type: 'Repository' },
	{ id: 2, name: 'Design Assets', type: 'Folder' },
	{ id: 3, name: 'API Keys', type: 'Secret' },
];

export const load: PageServerLoad = async () => {
	const form = await superValidate(valibot(confirmSchema));
	return { form, items: mockItems };
};

export const actions: Actions = {
	delete: async ({ request }) => {
		const form = await superValidate(request, valibot(confirmSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		await new Promise((r) => setTimeout(r, 500));

		return message(form, 'All items have been permanently deleted.');
	},
};
