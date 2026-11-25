import { describe, expect, it } from 'vitest';
import { REGISTRY } from '../src/lib/server/patterns/registry.ts';
import { EXPLORE_PATTERNS_TOOL, explorePatterns, type PatternExploration } from './dependency-explorer.ts';
import { NEXT_ACTIONS_HEADING } from './query.ts';

function focus(id: string) {
	const outcome = explorePatterns(REGISTRY, { id }, { siteOrigin: 'https://v10r.example' });
	if (!outcome.ok || outcome.exploration.kind !== 'focus') throw new Error(`no focus for ${id}`);
	return { text: outcome.text, exploration: outcome.exploration as Extract<PatternExploration, { kind: 'focus' }> };
}

const byId = new Map(REGISTRY.patterns.map((pattern) => [pattern.id, pattern]));

describe('explore_patterns definition', () => {
	it('stays name/description/inputSchema only (B1)', () => {
		expect(Object.keys(EXPLORE_PATTERNS_TOOL).sort()).toEqual(['description', 'inputSchema', 'name']);
	});
});

describe('explorePatterns — focus', () => {
	const hub = [...byId.values()].find((pattern) => pattern.depends_on.length > 0 && pattern.tier === 'deep');
	if (!hub) throw new Error('the registry has no deep pattern with a dependency');

	it('lists the transitive prerequisites in adoption order, each after its own prerequisites', () => {
		const { exploration } = focus(hub.id);
		const order = exploration.focus.prerequisites.map((entry) => entry.id);
		for (const dep of hub.depends_on) expect(order).toContain(dep);
		for (const [index, id] of order.entries()) {
			for (const dep of byId.get(id)?.depends_on ?? []) {
				if (order.includes(dep)) expect(order.indexOf(dep), `${dep} before ${id}`).toBeLessThan(index);
			}
		}
		for (const entry of exploration.focus.prerequisites) expect(entry.depth).toBeGreaterThanOrEqual(1);
	});

	it('lists every pattern that builds on the focus, directly or not', () => {
		const target = 'multi-client-core';
		const { exploration } = focus(target);
		const direct = REGISTRY.patterns.filter((pattern) => pattern.depends_on.includes(target)).map((p) => p.id);
		expect(exploration.focus.dependents).toEqual(direct);
		for (const id of direct) expect(exploration.focus.allDependents).toContain(id);
		for (const id of exploration.focus.allDependents) {
			// each dependent reaches the target through depends_on
			const seen = new Set<string>();
			const queue = [id];
			let reaches = false;
			while (queue.length > 0) {
				const current = queue.pop() as string;
				if (seen.has(current)) continue;
				seen.add(current);
				const deps = byId.get(current)?.depends_on ?? [];
				if (deps.includes(target)) reaches = true;
				queue.push(...deps);
			}
			expect(reaches, id).toBe(true);
		}
	});

	it('names every id it mentions in `patterns`, and nothing else', () => {
		const { exploration } = focus('multi-client-core');
		const named = new Set([
			exploration.focus.id,
			...exploration.focus.prerequisites.map((entry) => entry.id),
			...exploration.focus.allDependents,
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
		const { exploration, text } = focus('multi-client-core');
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
			(pattern) =>
				pattern.depends_on.length > 0 || REGISTRY.patterns.some((other) => other.depends_on.includes(pattern.id)),
		);
		expect(exploration.patterns.map((pattern) => pattern.id).sort()).toEqual(inGraph.map((p) => p.id).sort());
		expect(exploration.categories.flatMap((category) => category.patterns).sort()).toEqual(
			inGraph.map((p) => p.id).sort(),
		);
		expect(exploration.unconnected).toBe(REGISTRY.patterns.length - inGraph.length);
		expect(exploration.hubs[0].id).toBe('multi-client-core');
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
