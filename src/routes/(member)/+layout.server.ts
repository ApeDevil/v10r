import { requireAuth } from '$lib/server/auth/guards';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	requireAuth(locals, url.pathname + url.search);
	return {};
};
