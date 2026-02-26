import type { PageServerLoad, Actions } from './$types';
import { superValidate, fail, message, setError } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { serverSchema } from '$lib/schemas/showcase/validation';

export const load: PageServerLoad = async () => {
	const form = await superValidate(valibot(serverSchema));
	return { form };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await superValidate(request, valibot(serverSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		await new Promise((r) => setTimeout(r, 300));

		// Simulate server-side validation that the client can't do
		if (form.data.email.includes('taken')) {
			return setError(form, 'email', 'This email is already registered.');
		}

		if (form.data.inviteCode === 'EXPIRED1') {
			return message(form, 'This invite code has expired. Please request a new one.', { status: 400 });
		}

		if (form.data.inviteCode === 'INVALID1') {
			return setError(form, 'inviteCode', 'This invite code is not recognized.');
		}

		return message(form, `Welcome! Invite code ${form.data.inviteCode} accepted.`);
	},
};
