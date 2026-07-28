import { requireAdmin } from '$lib/server/auth/guards';
import type { LayoutServerLoad } from './$types';

/**
 * Guard hoisted here so both tabs inherit it. Deliberately returns NO `title`: the root layout
 * reads `page.data.title` for the document title, and a value set here would apply to every child
 * and mask each page's own.
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	return {};
};
