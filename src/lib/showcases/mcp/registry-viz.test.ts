import { describe, expect, it } from 'vitest';
// Direct JSON import is fine here: vitest runs server-side, so the client-graph
// fs.allow restriction that keeps this out of registry-viz.ts doesn't apply.
import registryJson from '$patterns/registry.json';
import type { Registry } from '$patterns/schema';
import { computeStats, DAG_SHORT_LABELS, toDagData } from './registry-viz';

// The narrowed `tier` union makes the JSON-inferred `string` unassignable —
// same deliberate cast as `src/lib/server/mcp/patterns/data.ts`.
const registry = registryJson as unknown as Registry;

const pattern = (
	id: string,
	category: string,
	depends_on: string[],
	invariants: string[],
	tier: 'deep' | 'light' = 'deep',
) => ({
	id,
	tier,
	title: `Title of ${id}`,
	category,
	summary: '',
	when_to_use: '',
	capabilities: [],
	keywords: [],
	depends_on,
	docs: [],
	code: [],
	tests: [],
	showcases: [],
	invariants,
	emulation_notes: [],
	risk: 'low',
	maturity: 'implemented' as const,
});

const fixture: Registry = {
	version: '0.0.0',
	groups: [{ id: 'g', title: 'G' }],
	categories: [
		{ id: 'architecture', title: 'Architecture', group: 'g' },
		{ id: 'ai', title: 'AI', group: 'g' },
		{ id: 'ui', title: 'UI', group: 'g' },
	],
	patterns: [
		pattern('core', 'architecture', [], ['a', 'b']),
		pattern('leaf', 'ai', ['core'], ['c']),
		pattern('island', 'ui', [], []),
		pattern('row', 'ui', ['core'], [], 'light'),
	],
};

describe('computeStats', () => {
	it('counts patterns, tiers, categories, edges, and invariants', () => {
		expect(computeStats(fixture)).toEqual({
			patternCount: 4,
			deepCount: 3,
			lightCount: 1,
			categoryCount: 3,
			edgeCount: 2,
			invariantCount: 3,
			categories: [
				{ name: 'architecture', count: 1 },
				{ name: 'ai', count: 1 },
				{ name: 'ui', count: 2 },
			],
		});
	});
});

describe('toDagData', () => {
	it('projects every DEEP pattern to a node, including edge-less ones', () => {
		const dag = toDagData(fixture, {});
		expect(dag.nodes.map((n) => n.id)).toEqual(['core', 'leaf', 'island']);
		expect(dag.nodes[0]?.group).toBe('architecture');
	});

	it('excludes light records and their edges from the graph', () => {
		const dag = toDagData(fixture, {});
		expect(dag.nodes.some((n) => n.id === 'row')).toBe(false);
		expect(dag.edges.some((e) => e.target === 'row')).toBe(false);
	});

	it('points edges dependency → dependent (topological build order)', () => {
		expect(toDagData(fixture, {}).edges).toEqual([{ source: 'core', target: 'leaf' }]);
	});

	it('prefers short labels and falls back to the title', () => {
		const dag = toDagData(fixture, { core: 'Core' });
		expect(dag.nodes[0]?.label).toBe('Core');
		expect(dag.nodes[1]?.label).toBe('Title of leaf');
	});
});

describe('live registry projection', () => {
	it('has a curated short label for every DEEP pattern (DagGraph nodes cannot fit titles)', () => {
		const deepIds = registry.patterns.filter((p) => p.tier === 'deep').map((p) => p.id);
		expect(Object.keys(DAG_SHORT_LABELS).sort()).toEqual(deepIds.sort());
	});

	it('produces one node per deep pattern with edges among real deep ids', () => {
		const deepIds = new Set(registry.patterns.filter((p) => p.tier === 'deep').map((p) => p.id));
		const dag = toDagData(registry);
		expect(dag.nodes.length).toBe(deepIds.size);
		for (const edge of dag.edges) {
			expect(deepIds.has(edge.source)).toBe(true);
			expect(deepIds.has(edge.target)).toBe(true);
		}
	});
});
