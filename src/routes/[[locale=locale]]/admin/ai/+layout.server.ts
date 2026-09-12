import { getActiveProviderInfo, loadProviderRegistry, publicProviderConnection } from '$lib/server/ai';
import { buildProviderQuota } from '$lib/server/ai/quota';
import { requireAdmin } from '$lib/server/http/guards';
import type { LayoutServerLoad } from './$types';

/**
 * AI section shell. Guards the whole `/admin/ai/*` subtree once and loads the saved
 * provider connections so the Overview tab can render health dots + a resources strip
 * (the Models tab renders the full quota board from the same `resources` data — single
 * source, no drift). Each page that needs to *resolve* against the registry loads its
 * own; entries carry model closures and cannot ride layout data.
 *
 * An unreadable settings table must not take the whole section down — the Models tab
 * is where an operator goes to fix exactly that — so it degrades to an empty board with
 * `settingsUnavailable` set.
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	requireAdmin(locals);

	try {
		const registry = await loadProviderRegistry();
		return {
			providers: registry.entries.map(publicProviderConnection),
			activeProvider: getActiveProviderInfo(registry),
			resources: await buildProviderQuota(registry),
			settingsUnavailable: false,
		};
	} catch {
		return { providers: [], activeProvider: null, resources: [], settingsUnavailable: true };
	}
};
