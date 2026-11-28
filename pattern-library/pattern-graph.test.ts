/**
 * Semantics of the typed relationships, on small synthetic registries: what adopting a record
 * makes a step, what stays an open decision, what needs and invariants travel along which
 * relationship, and that none of it depends on the order relationships are written in.
 * Validation of malformed graphs (the negative cases) is in `relationships.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { type Adoption, type ConditionDecisions, patternGraph, type ResolvedNeed } from './pattern-graph.ts';
import type { Assumption, Constituent, NeedEntry, PatternRecord, Registry, RelationshipRef } from './schema.ts';

interface Spec {
	kind?: PatternRecord['kind'];
	category?: string;
	needs?: NeedEntry[];
	builds_on?: string[];
	composes?: [id: string, level: Constituent['level'], when?: string][];
	specializes?: string;
	references?: string[];
	invariants?: string[];
	code?: string[];
}

const ref = (id: string): RelationshipRef => ({ id, why: `fixture: ${id}` });

function record(id: string, spec: Spec): PatternRecord {
	return {
		id,
		kind: spec.kind ?? 'pattern',
		category: spec.category ?? 'c',
		needs: spec.needs ?? [],
		builds_on: (spec.builds_on ?? []).map(ref),
		composes: (spec.composes ?? []).map(([target, level, when]) => ({
			...ref(target),
			level,
			...(when ? { when } : {}),
		})),
		specializes: spec.specializes ? ref(spec.specializes) : null,
		references: (spec.references ?? []).map(ref),
		invariants: spec.invariants ?? [],
		code: (spec.code ?? []).map((path) => ({ path })),
		alternatives: [],
	} as unknown as PatternRecord;
}

function graphOf(specs: Record<string, Spec>, assumptions: Assumption[] = []) {
	const patterns = Object.entries(specs).map(([id, spec]) => record(id, spec));
	return patternGraph({ assumptions, patterns } as unknown as Registry);
}

const need = (needs: readonly ResolvedNeed[], id: string) => needs.find((entry) => entry.need === id);
const decide = (entries: Record<string, 'satisfied' | 'unsatisfied'>): ConditionDecisions =>
	new Map(Object.entries(entries));
const openIds = (adoption: Adoption) => adoption.open.map((entry) => entry.id);

/** Every permutation, for order-independence checks. */
function permutations<T>(items: readonly T[]): T[][] {
	if (items.length <= 1) return [[...items]];
	return items.flatMap((item, index) =>
		permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]),
	);
}

describe('composition: required, conditional and optional constituents', () => {
	const g = graphOf({
		whole: {
			composes: [
				['part', 'required'],
				['maybe', 'conditional', 'the host is serverless'],
				['extra', 'optional', 'the team wants traces'],
			],
		},
		part: { needs: ['relational-db'] },
		maybe: { needs: ['key-value-store'] },
		extra: { needs: ['object-storage'] },
	});

	it('a required constituent is a step before its whole', () => {
		const adoption = g.adopt(['whole']);
		expect(adoption.steps).toEqual(['part', 'whole']);
		expect(adoption.reasons.get('part')).toEqual([{ kind: 'part_of', from: 'whole', level: 'required' }]);
	});

	it('conditional and optional constituents stay open while unknown — never adopted or dropped silently', () => {
		const adoption = g.adopt(['whole']);
		expect(adoption.open).toEqual([
			{
				id: 'maybe',
				level: 'conditional',
				state: 'unknown',
				proposedBy: [{ from: 'whole', level: 'conditional', when: 'the host is serverless' }],
			},
			{
				id: 'extra',
				level: 'optional',
				state: 'unknown',
				proposedBy: [{ from: 'whole', level: 'optional', when: 'the team wants traces' }],
			},
		]);
	});

	it('optional enhancement is not conditional necessity: their needs differ in level', () => {
		const needs = g.needs('whole');
		expect(need(needs, 'relational-db')?.level).toBe('required');
		expect(need(needs, 'key-value-store')).toMatchObject({
			level: 'conditional',
			conditions: ['the host is serverless'],
		});
		expect(need(needs, 'object-storage')?.level).toBe('optional');
	});

	it('a satisfied condition makes the constituent a step; an unsatisfied one removes it and its needs', () => {
		const satisfied = g.adopt(['whole'], decide({ maybe: 'satisfied', extra: 'satisfied' }));
		expect(satisfied.steps).toEqual(['part', 'maybe', 'extra', 'whole']);
		expect(satisfied.open).toEqual([]);
		expect(need(satisfied.needs, 'key-value-store')?.level).toBe('required');
		const unsatisfied = g.adopt(['whole'], decide({ maybe: 'unsatisfied' }));
		expect(unsatisfied.steps).toEqual(['part', 'whole']);
		expect(unsatisfied.open.find((entry) => entry.id === 'maybe')?.state).toBe('unsatisfied');
		expect(need(unsatisfied.needs, 'key-value-store')).toBeUndefined();
	});

	it('an unknown condition is never settled by the graph', () => {
		for (const adoption of [g.adopt(['whole']), g.adopt(['whole'], decide({ extra: 'satisfied' }))]) {
			expect(adoption.steps).not.toContain('maybe');
			expect(adoption.open.find((entry) => entry.id === 'maybe')?.state).toBe('unknown');
		}
	});
});

describe('recursive composition', () => {
	it('nested conditions accumulate as a conjunction along the path', () => {
		const g = graphOf({
			app: { composes: [['tier', 'conditional', 'multi-hop questions matter']] },
			tier: { composes: [['cache', 'conditional', 'several instances serve it']] },
			cache: { needs: ['key-value-store'] },
		});
		const kv = need(g.needs('app'), 'key-value-store');
		expect(kv?.level).toBe('conditional');
		expect(kv?.conditions).toEqual(['multi-hop questions matter and several instances serve it']);
		expect(kv?.sources[0].path).toEqual(['app', 'tier', 'cache']);
		// Settling the outer condition leaves the inner one open: one answer settles one question.
		const adoption = g.adopt(['app'], decide({ tier: 'satisfied' }));
		expect(adoption.steps).toEqual(['tier', 'app']);
		expect(openIds(adoption)).toEqual(['cache']);
	});

	it('an optional constituent makes everything it carries optional, however strict inside', () => {
		const g = graphOf({
			app: { composes: [['viewer', 'optional', 'the host renders views']] },
			viewer: { builds_on: ['engine'], needs: ['web-worker'] },
			engine: { needs: [{ need: 'relational-db', level: 'required', pinned: 'postgres' }] },
		});
		const needs = g.needs('app');
		expect(need(needs, 'web-worker')?.level).toBe('optional');
		expect(need(needs, 'relational-db')?.level).toBe('optional');
		// An optional need carries no pin: only required and conditional pins constrain a binding.
		expect(need(needs, 'relational-db')?.pins).toEqual([]);
	});

	it('a diamond builds the shared foundation once, before both sides, with both reasons', () => {
		const g = graphOf({
			top: { builds_on: ['left', 'right'] },
			left: { builds_on: ['base'] },
			right: { builds_on: ['base'] },
			base: { needs: ['relational-db'] },
		});
		const adoption = g.adopt(['top']);
		expect(adoption.steps).toEqual(['base', 'left', 'right', 'top']);
		expect(adoption.reasons.get('base')).toEqual([
			{ kind: 'builds_on', from: 'left' },
			{ kind: 'builds_on', from: 'right' },
		]);
		expect(need(adoption.needs, 'relational-db')?.origins).toEqual(['base']);
	});

	it('a constituent shared by a required and an optional path is a step, and its needs required', () => {
		const g = graphOf({
			whole: {
				composes: [
					['core', 'required'],
					['addon', 'optional', 'the team wants it'],
				],
			},
			core: { composes: [['shared', 'required']] },
			addon: { composes: [['shared', 'required']] },
			shared: { needs: ['key-value-store'] },
		});
		const adoption = g.adopt(['whole']);
		expect(adoption.steps).toContain('shared');
		expect(openIds(adoption)).toEqual(['addon']);
		expect(need(adoption.needs, 'key-value-store')?.level).toBe('required');
		const needs = g.needs('whole');
		expect(need(needs, 'key-value-store')?.level).toBe('required');
		expect(
			need(needs, 'key-value-store')
				?.sources.map((source) => source.level)
				.sort(),
		).toEqual(['optional', 'required']);
	});

	it('a constituent proposed by several wholes lists every proposer', () => {
		const g = graphOf({
			a: { composes: [['x', 'optional', 'a wants it']] },
			b: { composes: [['x', 'conditional', 'b runs serverless']] },
			x: {},
		});
		const adoption = g.adopt(['a', 'b']);
		expect(adoption.open).toEqual([
			{
				id: 'x',
				level: 'conditional',
				state: 'unknown',
				proposedBy: [
					{ from: 'a', level: 'optional', when: 'a wants it' },
					{ from: 'b', level: 'conditional', when: 'b runs serverless' },
				],
			},
		]);
	});
});

describe('requirement merging across origins', () => {
	it('multiple origins of one need are all kept, with their paths', () => {
		const g = graphOf({
			root: { builds_on: ['auth', 'jobs'] },
			auth: { needs: ['relational-db'] },
			jobs: { needs: ['relational-db', 'scheduler'] },
		});
		const db = need(g.needs('root'), 'relational-db');
		expect(db?.origins).toEqual(['auth', 'jobs']);
		expect(db?.inherited).toEqual(['auth', 'jobs']);
		expect(db?.sources.map((source) => source.path)).toEqual([
			['root', 'auth'],
			['root', 'jobs'],
		]);
	});

	it('an unrestricted declaration does not erase a pin', () => {
		const g = graphOf({
			root: { builds_on: ['plain', 'pinned'], needs: ['relational-db'] },
			plain: { needs: ['relational-db'] },
			pinned: { needs: [{ need: 'relational-db', level: 'required', pinned: 'postgres', why: 'uses advisory locks' }] },
		});
		expect(need(g.needs('root'), 'relational-db')?.pins).toEqual([
			{ technology: 'postgres', conditional: false, origins: ['pinned'] },
		]);
	});

	it('a conditional pin stays conditional beside an unconditional need', () => {
		const g = graphOf({
			root: { builds_on: ['base'], composes: [['graph', 'conditional', 'relationship questions matter']] },
			base: { needs: ['relational-db'] },
			graph: { needs: [{ need: 'relational-db', level: 'required', pinned: 'postgres', why: 'recursive CTEs' }] },
		});
		const db = need(g.needs('root'), 'relational-db');
		expect(db?.level).toBe('required');
		expect(db?.pins).toEqual([{ technology: 'postgres', conditional: true, origins: ['graph'] }]);
		expect(db?.conflict).toBeNull();
	});

	it('incompatible active pins are an explicit conflict; a conditional one only a possible conflict', () => {
		const certain = graphOf({
			root: { builds_on: ['a', 'b'] },
			a: { needs: [{ need: 'relational-db', level: 'required', pinned: 'postgres', why: 'locks' }] },
			b: { needs: [{ need: 'relational-db', level: 'required', pinned: 'mysql', why: 'legacy' }] },
		});
		expect(need(certain.needs('root'), 'relational-db')?.conflict).toEqual({
			technologies: ['mysql', 'postgres'],
			certain: true,
		});
		const possible = graphOf({
			root: { builds_on: ['a'], composes: [['b', 'conditional', 'the legacy shop is integrated']] },
			a: { needs: [{ need: 'relational-db', level: 'required', pinned: 'postgres', why: 'locks' }] },
			b: { needs: [{ need: 'relational-db', level: 'required', pinned: 'mysql', why: 'legacy' }] },
		});
		expect(need(possible.needs('root'), 'relational-db')?.conflict).toEqual({
			technologies: ['mysql', 'postgres'],
			certain: false,
		});
	});

	it('implementation and optional needs of a foundation stay its own', () => {
		const g = graphOf({
			root: { builds_on: ['base'] },
			base: {
				needs: [
					'relational-db',
					{ need: 'object-storage', level: 'implementation', why: 'v10r archives runs' },
					{ need: 'graph-db', level: 'optional', why: 'nice to have' },
				],
			},
		});
		const needs = g.needs('root');
		expect(need(needs, 'relational-db')?.level).toBe('required');
		expect(need(needs, 'object-storage')).toBeUndefined();
		expect(need(needs, 'graph-db')).toBeUndefined();
		expect(need(g.needs('base'), 'object-storage')?.level).toBe('implementation');
	});
});

describe('specialization', () => {
	const g = graphOf({
		parent: {
			builds_on: ['foundation'],
			composes: [
				['piece', 'required'],
				['detail', 'required'],
			],
			invariants: ['every result is reproducible'],
			needs: ['relational-db', { need: 'object-storage', level: 'implementation', why: 'v10r caches renders' }],
		},
		child: {
			specializes: 'parent',
			composes: [['detail', 'optional', 'the host renders views']],
			invariants: ['geometry is never executed code'],
		},
		foundation: {},
		piece: {},
		detail: {},
	});

	it('inherits the generalization’s foundations and constituents without making it a step', () => {
		const adoption = g.adopt(['child']);
		expect(adoption.steps).toEqual(['foundation', 'piece', 'child']);
		expect(adoption.steps).not.toContain('parent');
		expect(adoption.generalizations.get('child')).toEqual(['parent']);
		expect(adoption.reasons.get('foundation')).toEqual([{ kind: 'builds_on', from: 'child', inheritedFrom: 'parent' }]);
	});

	it('its own relationship to the same record wins over the inherited one', () => {
		const adoption = g.adopt(['child']);
		expect(adoption.steps).not.toContain('detail');
		expect(adoption.open).toEqual([
			{
				id: 'detail',
				level: 'optional',
				state: 'unknown',
				proposedBy: [{ from: 'child', level: 'optional', when: 'the host renders views' }],
			},
		]);
	});

	it('inherits invariants and applicable needs, never implementation details', () => {
		expect(g.inheritedInvariants('child')).toEqual([{ from: 'parent', invariants: ['every result is reproducible'] }]);
		expect(g.inheritedInvariants('parent')).toEqual([]);
		const needs = g.needs('child');
		expect(need(needs, 'relational-db')).toMatchObject({ level: 'required', origins: ['parent'] });
		expect(need(needs, 'object-storage')).toBeUndefined();
	});

	it('the inverse is derived: the parent is specialized by the child', () => {
		expect(g.edgesTo('parent', 'specializes').map((edge) => edge.from)).toEqual(['child']);
	});
});

describe('principles, assumptions and workflows', () => {
	const g = graphOf(
		{
			server: { code: ['src/lib/server/x.ts'] },
			ui: { code: ['src/lib/components/y.svelte'], builds_on: ['server'] },
			layered: { kind: 'principle' },
			philosophy: { kind: 'principle' },
			runbook: { kind: 'workflow', builds_on: ['server'] },
			explicit: { code: ['src/lib/server/z.ts'], builds_on: ['layered-impl'] },
			'layered-impl': {},
		},
		[
			{
				id: 'layered',
				applies_to: { code_under: ['src/lib/server/'] },
				why: 'server code keeps domains framework-free',
			},
			{ id: 'philosophy', applies_to: { ids: ['ui'] }, why: 'components follow the design philosophy' },
			{ id: 'layered-impl', applies_to: { code_under: ['src/lib/server/'] }, why: 'the platform convention' },
		],
	);

	it('a principle applies through its scope and is never a step', () => {
		expect(g.assumptionsFor('server').map((entry) => entry.id)).toEqual(['layered', 'layered-impl']);
		expect(g.assumptionsFor('ui').map((entry) => entry.id)).toEqual(['philosophy']);
		const adoption = g.adopt(['ui']);
		expect(adoption.steps).toEqual(['server', 'ui']);
		expect(adoption.assumptions.map(({ id, kind, steps }) => ({ id, kind, steps }))).toEqual([
			{ id: 'layered', kind: 'principle', steps: ['server'] },
			{ id: 'philosophy', kind: 'principle', steps: ['ui'] },
			{ id: 'layered-impl', kind: 'pattern', steps: ['server'] },
		]);
	});

	it('an explicit adoption wins over the assumption of the same record', () => {
		expect(g.assumptionsFor('explicit').map((entry) => entry.id)).toEqual(['layered']);
		expect(g.adopt(['explicit']).steps).toEqual(['layered-impl', 'explicit']);
	});

	it('a workflow is a procedure: it can build on patterns, and its foundations are steps before it', () => {
		const adoption = g.adopt(['runbook']);
		expect(adoption.steps).toEqual(['server', 'runbook']);
		expect(g.edgesTo('runbook')).toEqual([]);
	});
});

describe('references, isolation and determinism', () => {
	it('references may cycle and never add a step, a need or an invariant', () => {
		const g = graphOf({
			a: { references: ['b'], needs: ['scheduler'] },
			b: { references: ['a'], needs: ['relational-db'], invariants: ['b holds'] },
		});
		const adoption = g.adopt(['a']);
		expect(adoption.steps).toEqual(['a']);
		expect(adoption.cyclic).toBe(false);
		expect(g.needs('a').map((entry) => entry.need)).toEqual(['scheduler']);
		expect(g.inheritedInvariants('a')).toEqual([]);
		expect(g.edgesTo('a', 'references').map((edge) => edge.from)).toEqual(['b']);
	});

	it('an isolated record adopts as itself, with its own needs and no inverses', () => {
		const g = graphOf({ lone: { needs: ['llm-provider'] }, other: {} });
		const adoption = g.adopt(['lone']);
		expect(adoption.steps).toEqual(['lone']);
		expect(adoption.open).toEqual([]);
		expect(adoption.needs.map((entry) => entry.need)).toEqual(['llm-provider']);
		expect(g.edgesTo('lone')).toEqual([]);
	});

	it('an unknown requested id is ignored, never invented', () => {
		const g = graphOf({ known: {} });
		expect(g.adopt(['known', 'ghost']).steps).toEqual(['known']);
	});

	it('results are identical whatever order relationships and requests are written in', () => {
		const composes: [string, Constituent['level'], string?][] = [
			['p1', 'required'],
			['p2', 'conditional', 'serverless'],
			['p3', 'optional', 'tracing wanted'],
		];
		const builds = ['f1', 'f2'];
		const answers = new Set<string>();
		for (const composeOrder of permutations(composes)) {
			for (const buildOrder of permutations(builds)) {
				const g = graphOf({
					root: { builds_on: buildOrder, composes: composeOrder },
					f1: { needs: [{ need: 'relational-db', level: 'required', pinned: 'postgres', why: 'locks' }] },
					f2: { needs: ['relational-db', 'scheduler'] },
					p1: { builds_on: ['f1'] },
					p2: { needs: ['key-value-store'] },
					p3: { needs: ['object-storage'] },
				});
				for (const requested of [
					['root', 'p1'],
					['p1', 'root'],
				]) {
					const adoption = g.adopt(requested);
					answers.add(
						JSON.stringify({
							steps: adoption.steps,
							reasons: [...adoption.reasons],
							open: adoption.open,
							needs: adoption.needs.map(({ sources: _sources, ...rest }) => rest),
						}),
					);
				}
			}
		}
		expect(answers.size).toBe(1);
	});
});
