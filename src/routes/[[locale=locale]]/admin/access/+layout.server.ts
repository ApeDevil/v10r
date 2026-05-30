import { countPendingRequests } from '$lib/server/auth/grant-requests';
import { requireAdmin } from '$lib/server/auth/guards';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	const pendingRequestsCount = await countPendingRequests();
	return { pendingRequestsCount };
};
