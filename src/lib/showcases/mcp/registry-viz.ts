/**
 * Registry → visualization projections for the Pattern MCP showcase.
 *
 * Pure functions and types only — the registry JSON itself is imported by the
 * route's +page.server.ts, never here: this module is client-bundled, and a
 * client-graph import of /pattern-library/registry.json is 403'd by Vite's dev
 * server fs.allow (SSR works, the browser 500s). The record types come from
 * `$patterns/schema`, which exists precisely so both runtimes can share one
 * declaration; the import is type-only, so none of that module's validation
 * code reaches the client bundle. Structural validity is enforced upstream by
 * `patterns:validate` (wired into `bun run validate`), so nothing is
 * re-validated here.
 */

import type { DagData } from '$lib/components/viz/graph';
import type { Registry } from '$patterns/schema';

/** Slim per-pattern projection for the page's dependency table. */
export interface PatternRow {
	id: string;
	tier: 'deep' | 'light';
	category: string;
	depends_on: string[];
}

export interface RegistryStats {
	patternCount: number;
	deepCount: number;
	lightCount: number;
	categoryCount: number;
	edgeCount: number;
	invariantCount: number;
	/** Category breakdown in first-seen registry order. */
	categories: Array<{ name: string; count: number }>;
}

export function computeStats(reg: Registry): RegistryStats {
	const categories: Array<{ name: string; count: number }> = [];
	for (const pattern of reg.patterns) {
		const entry = categories.find((c) => c.name === pattern.category);
		if (entry) {
			entry.count += 1;
		} else {
			categories.push({ name: pattern.category, count: 1 });
		}
	}
	const deepCount = reg.patterns.filter((p) => p.tier === 'deep').length;
	return {
		patternCount: reg.patterns.length,
		deepCount,
		lightCount: reg.patterns.length - deepCount,
		categoryCount: categories.length,
		edgeCount: reg.patterns.reduce((sum, p) => sum + p.depends_on.length, 0),
		invariantCount: reg.patterns.reduce((sum, p) => sum + p.invariants.length, 0),
		categories,
	};
}

/**
 * DagGraph nodes are fixed 80×28px rects with non-wrapping SVG text — registry
 * titles overflow badly, so every DEEP pattern needs a hand-picked short label.
 * registry-viz.test.ts pins this map against the live registry's deep-tier ids;
 * light index rows are not graphed (see toDagData) and need no label here.
 */
export const DAG_SHORT_LABELS: Record<string, string> = {
	'multi-client-core': 'Multi-Client',
	'docs-nav-hubs': 'Docs Hubs',
	'pattern-index': 'Pattern Index',
	'ui-component-system': 'UI System',
	'jobs-scheduler': 'Jobs',
	'ai-tool-harness': 'Tool Harness',
	'ai-surfaces': 'AI Surfaces',
	'deskbot-approval-gate': 'Approval Gate',
	'layered-rag': 'Layered RAG',
	'retrieval-endpoints': 'Retrieval',
	'agent-experience': 'Agent AX',
	'desk-workspace': 'Desk',
};

/**
 * Faithful projection of the DEEP-tier subgraph. The DAG is about emulation
 * order — a deep-card concept — and the ~125 edge-less light index rows would
 * drown the graph in "not drawn" nodes, so only deep records (and edges whose
 * both endpoints are deep) are projected. A deep node with zero edges still
 * becomes a node (DagGraph won't draw it — the page's data table covers it;
 * don't fabricate edges). Edge direction is dependency → dependent, i.e. the
 * topological build order recommend_emulation_plan uses.
 */
export function toDagData(reg: Registry, shortLabels: Record<string, string> = DAG_SHORT_LABELS): DagData {
	const deep = reg.patterns.filter((p) => p.tier === 'deep');
	const deepIds = new Set(deep.map((p) => p.id));
	return {
		nodes: deep.map((p) => ({ id: p.id, label: shortLabels[p.id] ?? p.title, group: p.category })),
		edges: deep.flatMap((p) =>
			p.depends_on.filter((dep) => deepIds.has(dep)).map((dep) => ({ source: dep, target: p.id })),
		),
	};
}
