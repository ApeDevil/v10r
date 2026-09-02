import { error, fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import * as v from 'valibot';
import { cancelMyPendingRequest, createGrantRequest, GrantRequestPendingError } from '$lib/server/auth/grant-requests';
import { requireAuth } from '$lib/server/http/guards';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ title: 'Desk' });

const requestSchema = v.object({
	message: v.optional(v.pipe(v.string(), v.maxLength(500))),
});

export const actions: Actions = {
	requestBlogAccess: async ({ request, locals }) => {
		const { user } = requireAuth(locals);
		const form = await superValidate(request, valibot(requestSchema));
		if (!form.valid) return fail(400, { form });

		try {
			await createGrantRequest({
				userId: user.id,
				kind: 'blog-author',
				message: form.data.message,
			});
			return { form, requested: true };
		} catch (err) {
			if (err instanceof GrantRequestPendingError) return fail(409, { form, code: err.code });
			throw err;
		}
	},

	cancelBlogAccessRequest: async ({ locals }) => {
		const { user } = requireAuth(locals);
		const cancelled = await cancelMyPendingRequest(user.id, 'blog-author');
		if (!cancelled) error(404, 'No pending request');
		return { cancelled: true };
	},
};
