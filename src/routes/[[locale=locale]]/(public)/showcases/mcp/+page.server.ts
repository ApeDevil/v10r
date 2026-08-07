/**
 * Server-only home of the registry JSON import. The static import is inlined
 * by Vite at build time (a runtime fs read would not survive Vercel's function
 * bundling), and it must stay in a server module: importing it from anything
 * client-bundled makes the browser fetch /mcp/patterns.registry.json as a dev
 * module, which Vite's fs.allow rejects with a 403 (SSR renders fine, the
 * browser 500s). The page receives only the projected data it renders.
 */

import type { Registry } from '$lib/showcase/mcp/registry-viz';
import { computeStats, toDagData } from '$lib/showcase/mcp/registry-viz';
import registryJson from '../../../../../../mcp/patterns.registry.json';
import type { PageServerLoad } from './$types';

const registry = registryJson as unknown as Registry;

// Deep cards first (they carry the DAG), light index rows after — both in
// registry (= category) order within their tier. Sorted server-side so the
// table is deterministic without client work.
const rows = [...registry.patterns]
	.sort((a, b) => (a.tier === b.tier ? 0 : a.tier === 'deep' ? -1 : 1))
	.map((p) => ({ id: p.id, tier: p.tier, category: p.category, depends_on: p.depends_on }));

export const load: PageServerLoad = () => {
	return {
		title: 'Pattern MCP - Showcases',
		stats: computeStats(registry),
		dag: toDagData(registry),
		patterns: rows,
	};
};
