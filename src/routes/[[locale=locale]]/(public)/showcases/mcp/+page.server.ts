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

const registry: Registry = registryJson;

export const load: PageServerLoad = () => {
	return {
		title: 'Pattern MCP - Showcases',
		stats: computeStats(registry),
		dag: toDagData(registry),
		patterns: registry.patterns.map((p) => ({ id: p.id, category: p.category, depends_on: p.depends_on })),
	};
};
