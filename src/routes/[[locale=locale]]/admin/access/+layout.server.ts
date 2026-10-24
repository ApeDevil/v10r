import { countPendingRequests } from '#lib/server/auth/grant-requests.ts';
import { requireAdmin } from '#lib/server/http/guards.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	const pendingRequestsCount = await countPendingRequests();
	return { pendingRequestsCount };
};
