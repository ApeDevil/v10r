/**
 * Registry → visualization projections for the Pattern MCP showcase.
 *
 * Pure functions and types only — the registry JSON itself is imported by the
 * route's +page.server.ts, never here: this module is client-bundled, and a
 * client-graph import of /mcp/patterns.registry.json is 403'd by Vite's dev
 * server fs.allow (SSR works, the browser 500s). Types are mirrored locally
 * instead of importing mcp/registry.ts: that file is Bun-typed
 * (import.meta.dir) and deliberately outside the app's TS program. Structural
 * validity is enforced upstream by mcp/validate-registry.ts (wired into
 * `bun run validate`), so nothing is re-validated here.
 */
import type { DagData } from '$lib/components/viz/graph';

export interface RegRef {
	path: string;
	note?: string;
	kind?: string;
}

export interface RegistryPattern {
	id: string;
	title: string;
	category: string;
	summary: string;
	when_to_use: string;
	capabilities: string[];
	keywords: string[];
	depends_on: string[];
	docs: RegRef[];
	code: RegRef[];
	tests: RegRef[];
	showcases: RegRef[];
	invariants: string[];
	emulation_notes: string[];
	risk: string;
}

export interface Registry {
	version: string;
	note?: string;
	patterns: RegistryPattern[];
}

/** Slim per-pattern projection for the page's dependency table. */
export interface PatternRow {
	id: string;
	category: string;
	depends_on: string[];
}

export interface RegistryStats {
	patternCount: number;
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
	return {
		patternCount: reg.patterns.length,
		categoryCount: categories.length,
		edgeCount: reg.patterns.reduce((sum, p) => sum + p.depends_on.length, 0),
		invariantCount: reg.patterns.reduce((sum, p) => sum + p.invariants.length, 0),
		categories,
	};
}

/**
 * DagGraph nodes are fixed 80×28px rects with non-wrapping SVG text — registry
 * titles overflow badly, so every pattern needs a hand-picked short label.
 * registry-viz.test.ts pins this map against the live registry ids.
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
};

/**
 * Faithful 1:1 projection of the registry. Every pattern becomes a node even
 * with zero edges (DagGraph won't draw those — the page's data table covers
 * them; don't fabricate edges). Edge direction is dependency → dependent,
 * i.e. the topological build order recommend_emulation_plan uses.
 */
export function toDagData(reg: Registry, shortLabels: Record<string, string> = DAG_SHORT_LABELS): DagData {
	return {
		nodes: reg.patterns.map((p) => ({ id: p.id, label: shortLabels[p.id] ?? p.title, group: p.category })),
		edges: reg.patterns.flatMap((p) => p.depends_on.map((dep) => ({ source: dep, target: p.id }))),
	};
}
