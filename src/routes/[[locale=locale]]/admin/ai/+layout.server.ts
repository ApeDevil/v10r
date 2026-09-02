import { getActiveProviderInfo } from '$lib/server/ai';
import { getProviderStatuses } from '$lib/server/ai/provider-status';
import { buildProviderQuota } from '$lib/server/ai/quota';
import { requireAdmin } from '$lib/server/http/guards';
import type { LayoutServerLoad } from './$types';

/**
 * AI section shell. Guards the whole `/admin/ai/*` subtree once and shares the
 * provider snapshot so the Overview tab can render health dots + a resources
 * strip without re-resolving the registry (the Models tab renders the full
 * quota board from the same `resources` data — single source, no drift).
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	requireAdmin(locals);

	return {
		providers: getProviderStatuses(),
		activeProvider: getActiveProviderInfo(),
		resources: await buildProviderQuota(),
	};
};
