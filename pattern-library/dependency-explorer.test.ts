import { describe, expect, it } from 'vitest';
import { REGISTRY } from '../src/lib/server/patterns/registry.ts';
import { EXPLORE_PATTERNS_TOOL, explorePatterns, type PatternExploration } from './dependency-explorer.ts';
import { patternGraph } from './pattern-graph.ts';
import { NEXT_ACTIONS_HEADING } from './query.ts';
import { adoptionTargets } from './schema.ts';

function focus(id: string) {
	const outcome = explorePatterns(REGISTRY, { id }, { siteOrigin: 'https://v10r.example' });
	if (!outcome.ok || outcome.exploration.kind !== 'focus') throw new Error(`no focus for ${id}`);
	return { text: outcome.text, exploration: outcome.exploration as Extract<PatternExploration, { kind: 'focus' }> };
}

const byId = new Map(REGISTRY.patterns.map((pattern) => [pattern.id, pattern]));
const graph = patternGraph(REGISTRY);
/** What adopting a record makes a step without a decision: foundations and required constituents. */
const unconditional = (id: string) =>
	graph
		.effectiveEdges(id)
		.filter((edge) => edge.type === 'builds_on' || edge.level === 'required')
		.map((edge) => edge.to);
/** Every record whose adoption names `id` (builds on, composes at any level, specializes). */
const adopters = (id: string) =>
	REGISTRY.patterns.filter((pattern) => adoptionTargets(pattern).some((edge) => edge.id === id)).map((p) => p.id);
const MOST_ADOPTED = [...byId.keys()].sort((a, b) => adopters(b).length - adopters(a).length)[0];

describe('explore_patterns definition', () => {
	it('stays name/description/inputSchema only (B1)', () => {
		expect(Object.keys(EXPLORE_PATTERNS_TOOL).sort()).toEqual(['description', 'inputSchema', 'name']);
	});
});

describe('explorePatterns — focus', () => {
	const hub = [...byId.values()].find(
		(pattern) => pattern.tier === 'deep' && pattern.builds_on.length > 0 && pattern.composes.length > 0,
	);
	if (!hub) throw new Error('the registry has no deep pattern that builds on and composes others');

	it('lists what adopting it builds in adoption order, each after its own foundations and constituents', () => {
		const { exploration } = focus(hub.id);
		const order = exploration.focus.prerequisites.map((entry) => entry.id);
		for (const id of unconditional(hub.id)) expect(order).toContain(id);
		for (const [index, id] of order.entries()) {
			for (const dep of unconditional(id)) {
				if (order.includes(dep)) expect(order.indexOf(dep), `${dep} before ${id}`).toBeLessThan(index);
			}
		}
		for (const entry of exploration.focus.prerequisites) expect(entry.depth).toBeGreaterThanOrEqual(1);
		for (const entry of hub.builds_on) {
			expect(exploration.focus.prerequisites.find((step) => step.id === entry.id)?.relation).toBe('builds_on');
		}
	});

	it('keeps conditional and optional constituents open, never as steps', () => {
		const { exploration } = focus(hub.id);
		const steps = exploration.focus.prerequisites.map((entry) => entry.id);
		for (const entry of hub.composes.filter((constituent) => constituent.level !== 'required')) {
			expect(steps, entry.id).not.toContain(entry.id);
			expect(exploration.focus.open.map((open) => open.id)).toContain(entry.id);
		}
	});

	it('lists every pattern that builds on, contains or specializes the focus, directly or not', () => {
		const target = MOST_ADOPTED;
		const { exploration } = focus(target);
		const direct = adopters(target);
		expect(exploration.focus.dependents).toEqual(direct);
		for (const id of direct) expect(exploration.focus.allDependents).toContain(id);
		for (const id of exploration.focus.allDependents) {
			// each adopter reaches the target through adoption relationships
			const seen = new Set<string>();
			const queue = [id];
			let reaches = false;
			while (queue.length > 0) {
				const current = queue.pop() as string;
				if (seen.has(current)) continue;
				seen.add(current);
				const pattern = byId.get(current);
				const deps = pattern ? adoptionTargets(pattern).map((edge) => edge.id) : [];
				if (deps.includes(target)) reaches = true;
				queue.push(...deps);
			}
			expect(reaches, id).toBe(true);
		}
	});

	it('names every id it mentions in `patterns`, and nothing else', () => {
		const { exploration } = focus(hub.id);
		const named = new Set([
			exploration.focus.id,
			...exploration.focus.prerequisites.map((entry) => entry.id),
			...exploration.focus.allDependents,
			...exploration.focus.open.map((entry) => entry.id),
			...exploration.focus.references,
			...exploration.focus.referencedBy,
			...(exploration.focus.specializes ? [exploration.focus.specializes] : []),
		]);
		expect(new Set(exploration.patterns.map((pattern) => pattern.id))).toEqual(named);
	});

	it('summarises invariants and links the docs page on the given origin', () => {
		const { exploration, text } = focus(hub.id);
		expect(exploration.focus.invariantCount).toBe(hub.invariants.length);
		expect(exploration.focus.invariants).toEqual(hub.invariants.slice(0, 3));
		expect(exploration.focus.maturity).toBe(hub.maturity);
		expect(exploration.focus.docsUrl).toBe(`https://v10r.example/docs/pattern-library/${hub.id}`);
		expect(text).toContain(exploration.focus.docsUrl);
		expect(text).toContain(NEXT_ACTIONS_HEADING);
	});

	it('the text fallback carries the same graph as the JSON', () => {
		const { exploration, text } = focus(MOST_ADOPTED);
		for (const id of exploration.focus.allDependents) expect(text).toContain(`\`${id}\``);
		for (const { id } of exploration.focus.prerequisites) expect(text).toContain(`\`${id}\``);
	});
});

describe('explorePatterns — overview and refusals', () => {
	it('without an id: every pattern in the graph, by category, with hubs', () => {
		const outcome = explorePatterns(REGISTRY, {});
		if (!outcome.ok || outcome.exploration.kind !== 'overview') throw new Error('no overview');
		const { exploration } = outcome;
		const inGraph = REGISTRY.patterns.filter(
			(pattern) => adoptionTargets(pattern).length > 0 || adopters(pattern.id).length > 0,
		);
		expect(exploration.patterns.map((pattern) => pattern.id).sort()).toEqual(inGraph.map((p) => p.id).sort());
		expect(exploration.categories.flatMap((category) => category.patterns).sort()).toEqual(
			inGraph.map((p) => p.id).sort(),
		);
		expect(exploration.unconnected).toBe(REGISTRY.patterns.length - inGraph.length);
		expect(exploration.hubs[0].id).toBe(MOST_ADOPTED);
		// A reference is navigation, not adoption: a record related only by references stands alone.
		const referenceOnly = REGISTRY.patterns.filter(
			(pattern) =>
				pattern.references.length > 0 && adoptionTargets(pattern).length === 0 && adopters(pattern.id).length === 0,
		);
		for (const pattern of referenceOnly)
			expect(exploration.patterns.map((entry) => entry.id)).not.toContain(pattern.id);
	});

	it('refuses a malformed id and names a recovery', () => {
		for (const id of [42, '', 'x'.repeat(513)]) {
			const outcome = explorePatterns(REGISTRY, { id });
			expect(outcome.ok).toBe(false);
			if (!outcome.ok) {
				expect(outcome.diag).toBe('invalid_args');
				expect(outcome.next.length).toBeGreaterThan(0);
			}
		}
	});

	it('reports an unknown id as not_found, a registry gap', () => {
		const outcome = explorePatterns(REGISTRY, { id: 'no-such-pattern' });
		expect(outcome).toMatchObject({ ok: false, diag: 'not_found' });
	});
});
