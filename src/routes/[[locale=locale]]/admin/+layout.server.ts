import { requireAdmin } from '$lib/server/auth/guards';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	requireAdmin(locals, url.pathname + url.search);
	return {};
};
