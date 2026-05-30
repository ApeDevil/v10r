import { fail } from '@sveltejs/kit';
import { approveRequest, denyRequest, listPendingRequests } from '$lib/server/auth/grant-requests';
import { requireAdmin } from '$lib/server/auth/guards';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	const items = await listPendingRequests();
	return { items };
};

export const actions: Actions = {
	approve: async ({ request, locals }) => {
		const { user } = requireAdmin(locals);
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '');
		if (!id) return fail(400, { error: 'id required' });
		try {
			await approveRequest({
				requestId: id,
				actor: { id: user.id, email: user.email },
				ipAddress: locals.clientIp,
			});
			return { approved: true };
		} catch {
			return fail(409, { error: 'Already resolved' });
		}
	},
	deny: async ({ request, locals }) => {
		const { user } = requireAdmin(locals);
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '');
		const reason = String(fd.get('reason') ?? '') || undefined;
		if (!id) return fail(400, { error: 'id required' });
		try {
			await denyRequest({
				requestId: id,
				actor: { id: user.id, email: user.email },
				reason,
				ipAddress: locals.clientIp,
			});
			return { denied: true };
		} catch {
			return fail(409, { error: 'Already resolved' });
		}
	},
};
