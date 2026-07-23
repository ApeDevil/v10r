import { requireAdmin } from '$lib/server/auth/guards';
import { DEMO_COLORS, MAX_MESSAGE_LENGTH } from '$lib/server/mcp/demo/constants';
import { getDemoState } from '$lib/server/mcp/demo/service';
import type { PageServerLoad } from './$types';

/**
 * Protected read-only view of the MCP demo state. Inherits the admin guard from
 * `admin/+layout.server.ts` and re-asserts it here (defence in depth). Reads through the SAME
 * demo-state domain service the admin MCP writes to — no business logic lives in this handler.
 *
 * If the `mcp.demo_state` table has not been provisioned yet (db:push not run), the page
 * degrades to an "unavailable" notice instead of 500-ing.
 */
export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	try {
		const state = await getDemoState();
		return {
			title: 'MCP Test',
			state,
			colors: [...DEMO_COLORS],
			maxMessageLength: MAX_MESSAGE_LENGTH,
			unavailable: false,
		};
	} catch (cause) {
		// Log the real cause server-side; never surface raw DB/SQL text to the page.
		console.error('[admin/mcp] demo state unavailable:', cause);
		return {
			title: 'MCP Test',
			state: null,
			colors: [...DEMO_COLORS],
			maxMessageLength: MAX_MESSAGE_LENGTH,
			unavailable: true,
		};
	}
};
