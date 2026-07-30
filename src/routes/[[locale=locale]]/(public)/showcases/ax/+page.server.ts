/**
 * AGENTS.md is inlined at build time via a server-only glob (same reasoning as
 * the mcp showcase's registry import): a runtime fs read doesn't survive Vercel
 * function bundling, and a client-graph import of a repo-root file is 403'd by
 * the dev server's fs.allow (SSR works, the browser 500s).
 */
import type { PageServerLoad } from './$types';

const agentsMdModules = import.meta.glob('/AGENTS.md', {
	query: '?raw',
	import: 'default',
	eager: true,
}) as Record<string, string>;

export const load: PageServerLoad = () => {
	return {
		title: 'Agent Experience',
		agentsMd: agentsMdModules['/AGENTS.md'] ?? '',
	};
};
