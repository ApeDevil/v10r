import { requireAdmin } from '$lib/server/http/guards';
import { neonConfigured } from '$lib/server/neon';
import type { LayoutServerLoad } from './$types';

/**
 * Database section shell. Guards the whole `/admin/db/*` subtree once and shares
 * whether the Neon Management API is configured so the Mirror/Runs tabs can gate
 * their controls (observe-only when the key is absent).
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	return { configured: neonConfigured() };
};
