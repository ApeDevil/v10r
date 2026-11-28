/**
 * Semantics of the typed relationships, on small synthetic registries: what adopting a record
 * makes a step, what stays an open decision, what needs and invariants travel along which
 * relationship, and that none of it depends on the order relationships are written in.
 * Validation of malformed graphs (the negative cases) is in `relationships.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import {
	type Adoption,
	type AdoptionContext,
	compositionCondition as cond,
	type ConditionDecisions,
	needCondition,
	patternGraph,
	type Proposal,
	type ResolvedNeed,
} from './pattern-graph.ts';
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
const decisions = (entries: Record<string, 'satisfied' | 'unsatisfied'>): ConditionDecisions =>
	new Map(Object.entries(entries));
const decide = (entries: Record<string, 'satisfied' | 'unsatisfied'>): AdoptionContext => ({
	conditions: decisions(entries),
});
/** A proposal as the graph reports it: the condition is the proposing relationship's own. */
const proposal = (
	from: string,
	to: string,
	level: Proposal['level'],
	when: string,
	state: Proposal['state'] = 'unknown',
	inheritedFrom?: string,
): Proposal => ({
	from,
	level,
	condition: {
		id: cond(inheritedFrom ?? from, to),
		when,
		origin: { kind: 'composes', from: inheritedFrom ?? from, to },
	},
	state,
	...(inheritedFrom ? { inheritedFrom } : {}),
});
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
		expect(adoption.reasons.get('part')).toEqual([
			{ kind: 'part_of', from: 'whole', level: 'required', binding: 'required' },
		]);
	});

	it('conditional and optional constituents stay open while unknown — never adopted or dropped silently', () => {
		const adoption = g.adopt(['whole']);
		expect(adoption.open).toEqual([
			{
				id: 'maybe',
				level: 'conditional',
				proposedBy: [proposal('whole', 'maybe', 'conditional', 'the host is serverless')],
			},
			{
				id: 'extra',
				level: 'optional',
				proposedBy: [proposal('whole', 'extra', 'optional', 'the team wants traces')],
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

	it('a satisfied condition makes a conditional constituent required; an unsatisfied one removes it and its needs', () => {
		const satisfied = g.adopt(['whole'], decide({ [cond('whole', 'maybe')]: 'satisfied' }));
		expect(satisfied.steps).toEqual(['part', 'maybe', 'whole']);
		expect(satisfied.reasons.get('maybe')).toEqual([
			{
				kind: 'part_of',
				from: 'whole',
				level: 'conditional',
				binding: 'condition',
				condition: proposal('whole', 'maybe', 'conditional', 'the host is serverless').condition,
			},
		]);
		expect(need(satisfied.needs, 'key-value-store')?.level).toBe('required');
		const unsatisfied = g.adopt(['whole'], decide({ [cond('whole', 'maybe')]: 'unsatisfied' }));
		expect(unsatisfied.steps).toEqual(['part', 'whole']);
		expect(unsatisfied.open.find((entry) => entry.id === 'maybe')?.proposedBy[0].state).toBe('unsatisfied');
		expect(need(unsatisfied.needs, 'key-value-store')).toBeUndefined();
	});

	it('a satisfied condition on an optional constituent does not select it', () => {
		const adoption = g.adopt(['whole'], decide({ [cond('whole', 'extra')]: 'satisfied' }));
		expect(adoption.steps).not.toContain('extra');
		expect(adoption.open.find((entry) => entry.id === 'extra')?.proposedBy).toEqual([
			proposal('whole', 'extra', 'optional', 'the team wants traces', 'satisfied'),
		]);
		// Applicable, not adopted: its needs stay optional, no longer under the settled condition.
		expect(need(adoption.needs, 'object-storage')).toMatchObject({ level: 'optional', conditions: [] });
	});

	it('a selected optional constituent is a step, with its needs, and says it was selected', () => {
		const adoption = g.adopt(['whole'], { selected: new Set(['extra']) });
		expect(adoption.steps).toEqual(['part', 'extra', 'whole']);
		expect(adoption.reasons.get('extra')?.[0]).toMatchObject({
			kind: 'part_of',
			binding: 'selected',
			level: 'optional',
		});
		expect(need(adoption.needs, 'object-storage')?.level).toBe('required');
	});

	it('an explicitly requested optional constituent is a step, and its optional relationship stays visible', () => {
		const adoption = g.adopt(['whole', 'extra']);
		expect(adoption.steps).toContain('extra');
		expect(openIds(adoption)).toEqual(['maybe']);
		expect(adoption.reasons.get('extra')).toEqual([
			{ kind: 'requested' },
			{ kind: 'proposed', ...proposal('whole', 'extra', 'optional', 'the team wants traces') },
		]);
		expect(need(adoption.needs, 'object-storage')?.level).toBe('required');
	});

	it('an unknown condition is never settled by the graph, and a decision keyed by the constituent settles nothing', () => {
		for (const adoption of [
			g.adopt(['whole']),
			g.adopt(['whole'], decide({ [cond('whole', 'extra')]: 'satisfied' })),
			g.adopt(['whole'], decide({ maybe: 'satisfied' })),
		]) {
			expect(adoption.steps).not.toContain('maybe');
			expect(adoption.open.find((entry) => entry.id === 'maybe')?.proposedBy[0].state).toBe('unknown');
		}
	});

	it('lists every condition an adoption can meet, by its declaration', () => {
		expect(g.conditionsOf('whole').map((condition) => condition.id)).toEqual([
			cond('whole', 'extra'),
			cond('whole', 'maybe'),
		]);
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
		expect(kv?.conditionIds).toEqual([[cond('app', 'tier'), cond('tier', 'cache')]]);
		const adoption = g.adopt(['app'], decide({ [cond('app', 'tier')]: 'satisfied' }));
		expect(adoption.steps).toEqual(['tier', 'app']);
		expect(openIds(adoption)).toEqual(['cache']);
		expect(need(adoption.needs, 'key-value-store')?.conditions).toEqual(['several instances serve it']);
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
				proposedBy: [
					proposal('a', 'x', 'optional', 'a wants it'),
					proposal('b', 'x', 'conditional', 'b runs serverless'),
				],
			},
		]);
	});

	it('independent conditions on a shared constituent are settled independently', () => {
		const g = graphOf({
			a: { composes: [['x', 'conditional', 'a runs serverless']] },
			b: { composes: [['x', 'conditional', 'b serves several regions']] },
			x: { needs: ['key-value-store'] },
		});
		const none = g.needs('a');
		expect(need(none, 'key-value-store')?.conditions).toEqual(['a runs serverless']);
		// b's condition holds; a's is still unknown. x is required by b — and a's question stays visible.
		const adoption = g.adopt(['a', 'b'], decide({ [cond('b', 'x')]: 'satisfied' }));
		expect(adoption.steps).toContain('x');
		expect(adoption.reasons.get('x')).toEqual([
			{
				kind: 'part_of',
				from: 'b',
				level: 'conditional',
				binding: 'condition',
				condition: proposal('b', 'x', 'conditional', 'b serves several regions').condition,
			},
			{ kind: 'proposed', ...proposal('a', 'x', 'conditional', 'a runs serverless') },
		]);
		// a's condition is unsatisfied, b's unknown: x stays open on b's condition only.
		const other = g.adopt(['a', 'b'], decide({ [cond('a', 'x')]: 'unsatisfied' }));
		expect(other.steps).not.toContain('x');
		expect(other.open[0].proposedBy.map((entry) => [entry.from, entry.state])).toEqual([
			['a', 'unsatisfied'],
			['b', 'unknown'],
		]);
		expect(need(other.needs, 'key-value-store')?.conditions).toEqual(['b serves several regions']);
	});

	it('alternatives across paths stay alternatives; conjunctions along a path stay conjunctions', () => {
		const g = graphOf({
			app: {
				composes: [
					['left', 'conditional', 'L'],
					['right', 'conditional', 'R'],
				],
			},
			left: { composes: [['cache', 'conditional', 'L2']] },
			right: { builds_on: ['cache'] },
			cache: { needs: ['key-value-store'] },
		});
		const kv = need(g.needs('app'), 'key-value-store');
		expect(kv?.conditions).toEqual(['L and L2', 'R']);
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
			{ technology: 'postgres', conditional: false, conditions: [], origins: ['pinned'] },
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
		expect(db?.pins).toEqual([
			{ technology: 'postgres', conditional: true, conditions: ['relationship questions matter'], origins: ['graph'] },
		]);
		expect(db?.conflict).toBeNull();
	});

	it('a conditional need declaration is a condition of its own, settled by its id', () => {
		const g = graphOf({
			root: { builds_on: ['base'] },
			base: {
				needs: [{ need: 'key-value-store', level: 'conditional', when: 'several instances serve', pinned: 'redis' }],
			},
		});
		expect(g.conditionsOf('root').map((condition) => condition.id)).toEqual([needCondition('base', 'key-value-store')]);
		const open = need(g.needs('root'), 'key-value-store');
		expect(open?.level).toBe('conditional');
		expect(open?.pins[0]).toMatchObject({ conditional: true, conditions: ['several instances serve'] });
		const holds = g.adopt(['root'], decide({ [needCondition('base', 'key-value-store')]: 'satisfied' }));
		expect(need(holds.needs, 'key-value-store')).toMatchObject({ level: 'required', conditions: [] });
		expect(need(holds.needs, 'key-value-store')?.pins[0]).toMatchObject({ conditional: false });
		const fails = g.adopt(['root'], decide({ [needCondition('base', 'key-value-store')]: 'unsatisfied' }));
		expect(need(fails.needs, 'key-value-store')).toBeUndefined();
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
				['detail', 'conditional', 'the host renders views'],
			],
			invariants: ['every result is reproducible'],
			needs: ['relational-db', { need: 'object-storage', level: 'implementation', why: 'v10r caches renders' }],
		},
		child: {
			specializes: 'parent',
			composes: [['detail', 'required']],
			references: ['piece'],
			invariants: ['geometry is never executed code'],
		},
		foundation: {},
		piece: {},
		detail: {},
	});

	it('inherits the generalization’s foundations and constituents without making it a step', () => {
		const adoption = g.adopt(['child']);
		expect(adoption.steps).toEqual(['foundation', 'piece', 'detail', 'child']);
		expect(adoption.steps).not.toContain('parent');
		expect(adoption.generalizations.get('child')).toEqual(['parent']);
		expect(adoption.reasons.get('foundation')).toEqual([{ kind: 'builds_on', from: 'child', inheritedFrom: 'parent' }]);
	});

	it('its own compatible relationship to the same record wins over the inherited one', () => {
		const adoption = g.adopt(['child']);
		expect(adoption.reasons.get('detail')).toEqual([
			{ kind: 'part_of', from: 'child', level: 'required', binding: 'required' },
		]);
		expect(adoption.open).toEqual([]);
		expect(g.adopt(['parent']).open.map((entry) => entry.id)).toEqual(['detail']);
	});

	it('a reference never suppresses an inherited relationship', () => {
		// child references piece; piece is still its required constituent, inherited from parent.
		expect(g.effectiveEdges('child').find((edge) => edge.to === 'piece')).toMatchObject({
			type: 'composes',
			level: 'required',
			inheritedFrom: 'parent',
		});
		expect(g.adopt(['child']).reasons.get('piece')).toEqual([
			{ kind: 'part_of', from: 'child', level: 'required', binding: 'required', inheritedFrom: 'parent' },
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

describe('references change no planning consequence', () => {
	const base = {
		top: { builds_on: ['found'], composes: [['part', 'required'] as [string, 'required']] },
		found: { needs: ['relational-db' as NeedEntry] },
		part: { builds_on: ['deep'] },
		deep: { needs: [{ need: 'key-value-store', level: 'conditional', when: 'several instances' } as NeedEntry] },
		other: { needs: ['graph-db' as NeedEntry], builds_on: ['found'] },
	};
	const withRefs = Object.fromEntries(
		Object.entries(base).map(([id, spec]) => [
			id,
			{ ...spec, references: ['other', 'deep', 'found'].filter((to) => to !== id) },
		]),
	) as Record<string, Spec>;
	const plain = graphOf(base);
	const referenced = graphOf(withRefs);
	const shape = (adoption: Adoption) => ({
		steps: adoption.steps,
		reasons: [...adoption.reasons],
		open: adoption.open,
		needs: adoption.needs.map(({ sources: _sources, ...rest }) => rest),
	});

	it('the adoption closure, inherited prerequisites and infrastructure needs are identical with references added', () => {
		expect(shape(referenced.adopt(['top']))).toEqual(shape(plain.adopt(['top'])));
		expect(referenced.adopt(['top']).steps).not.toContain('other');
		expect(referenced.needs('top')).toEqual(plain.needs('top'));
	});

	it('…including through a specialization whose generalization the specialization also references', () => {
		const specs = { ...base, child: { specializes: 'top', references: ['part', 'found'] } } as Record<string, Spec>;
		const g = graphOf(specs);
		expect(g.adopt(['child']).steps).toEqual(['found', 'deep', 'part', 'child']);
		expect(need(g.needs('child'), 'relational-db')?.level).toBe('required');
		expect(need(g.needs('child'), 'key-value-store')?.level).toBe('conditional');
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
