import { describe, expect, it } from 'vitest';
// Direct JSON import is fine here: vitest runs server-side, so the client-graph
// fs.allow restriction that keeps this out of registry-viz.ts doesn't apply.
import registryJson from '../../../../mcp/patterns.registry.json';
import { computeStats, DAG_SHORT_LABELS, type Registry, toDagData } from './registry-viz';

const registry: Registry = registryJson;

const pattern = (id: string, category: string, depends_on: string[], invariants: string[]) => ({
	id,
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
});

const fixture: Registry = {
	version: '0.0.0',
	patterns: [
		pattern('core', 'architecture', [], ['a', 'b']),
		pattern('leaf', 'ai', ['core'], ['c']),
		pattern('island', 'ui', [], []),
	],
};

describe('computeStats', () => {
	it('counts patterns, categories, edges, and invariants', () => {
		expect(computeStats(fixture)).toEqual({
			patternCount: 3,
			categoryCount: 3,
			edgeCount: 1,
			invariantCount: 3,
			categories: [
				{ name: 'architecture', count: 1 },
				{ name: 'ai', count: 1 },
				{ name: 'ui', count: 1 },
			],
		});
	});
});

describe('toDagData', () => {
	it('projects every pattern to a node, including edge-less ones', () => {
		const dag = toDagData(fixture, {});
		expect(dag.nodes.map((n) => n.id)).toEqual(['core', 'leaf', 'island']);
		expect(dag.nodes[0]?.group).toBe('architecture');
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
	it('has a curated short label for every pattern (DagGraph nodes cannot fit titles)', () => {
		expect(Object.keys(DAG_SHORT_LABELS).sort()).toEqual(registry.patterns.map((p) => p.id).sort());
	});

	it('produces edges whose endpoints are all real pattern ids', () => {
		const ids = new Set(registry.patterns.map((p) => p.id));
		const dag = toDagData(registry);
		expect(dag.nodes.length).toBe(registry.patterns.length);
		for (const edge of dag.edges) {
			expect(ids.has(edge.source)).toBe(true);
			expect(ids.has(edge.target)).toBe(true);
		}
	});
});
