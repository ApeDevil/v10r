/**
 * The semantic graph of the pattern library: the ONE implementation of relationship
 * interpretation, traversal, recursive composition, specialization, infrastructure resolution,
 * invariant inheritance, scoped assumptions, derived inverses and provenance. Every reader — MCP
 * tools, the dependency explorer, docs pages, Agent Skills, Vely, the benchmark — asks this module;
 * none walks the relationships itself (`pattern-graph.gate.test.ts`).
 *
 * The registry stays the only authority: the graph is a pure, deterministic view built from it,
 * framework-free and filesystem-free, so it runs in the offline MCP bundle as well as in the app.
 * Results never depend on traversal order: every set is sorted before it is returned.
 */
import {
	type AdoptionRelationship,
	type Assumption,
	adoptionTargets,
	type ConstituentLevel,
	type InfrastructureNeed,
	inScope,
	NEED_LEVELS,
	type NeedLevel,
	needDeclaration,
	type PatternRecord,
	type Registry,
	type RelationshipType,
} from './schema.ts';

/** What each relationship means and what it does — the reference every surface quotes. */
export const RELATIONSHIP_SEMANTICS: Record<
	RelationshipType,
	{ meaning: string; inverse: string; adoption: string; needs: string; invariants: string }
> = {
	builds_on: {
		meaning: 'a foundation that must be available for the record to operate; the target’s own equivalent satisfies it',
		inverse: 'built on by',
		adoption: 'the foundation is a step ordered before the record, replaceable by an equivalent the target already has',
		needs: 'its required and conditional needs become the record’s; optional and implementation needs stay its own',
		invariants: 'stay the foundation’s own: they hold in its step, they are not copied onto the record',
	},
	composes: {
		meaning:
			'a constituent of the record’s solution: required (always part of it), conditional (must be adopted when its condition holds) or optional (an enhancement that may be omitted even when its condition holds)',
		inverse: 'part of',
		adoption:
			'a required constituent is a step; a conditional one is a step when its condition is satisfied (it is then required) or the caller selects it, an open decision while unknown, and omitted when unsatisfied; an optional one is a step only when the caller selects or requests it — a satisfied condition alone never adopts it',
		needs:
			'a required constituent’s needs propagate like a foundation’s; a conditional constituent’s required needs become conditional on its condition; an optional constituent’s needs are optional',
		invariants: 'stay the constituent’s own',
	},
	specializes: {
		meaning: 'the record is a narrower realization of the target: every record of this kind is one of those',
		inverse: 'specialized by',
		adoption:
			'the generalization is never a second implementation step: its foundations and constituents apply to the specialization at their own levels (the specialization’s own relationship to the same record wins)',
		needs: 'the generalization’s required, conditional and optional needs apply; its implementation needs do not',
		invariants: 'inherited: every invariant of the generalization holds in the specialization',
	},
	references: {
		meaning: 'planning-neutral context worth navigating; neither record needs the other',
		inverse: 'referenced by',
		adoption: 'none: a reference is never a step',
		needs: 'none propagate',
		invariants: 'none propagate',
	},
};

/** One authored relationship, as an edge. */
export interface Edge {
	type: RelationshipType;
	from: string;
	to: string;
	why: string;
	level?: ConstituentLevel;
	when?: string;
}

/** An adoption edge in force for a record: its own, or one inherited from a generalization. */
export interface EffectiveEdge extends Edge {
	type: 'builds_on' | 'composes';
	/** The generalization that authored the edge, when the record inherits it. */
	inheritedFrom?: string;
}

/** A condition's state: settled by the caller, never guessed. */
export type ConditionState = 'satisfied' | 'unsatisfied' | 'unknown';

/**
 * A condition's identity is the declaration that states it, never its target or its text: a
 * conditional or optional constituent (`<whole>/composes/<constituent>`) or a conditional need
 * (`<record>/needs/<need>`). Two wholes that compose the same record under their own conditions
 * hold two independent conditions; an inherited edge keeps its generalization's condition.
 */
export interface Condition {
	id: string;
	when: string;
	origin: { kind: 'composes'; from: string; to: string } | { kind: 'need'; declarer: string; need: InfrastructureNeed };
}

export const compositionCondition = (from: string, to: string) => `${from}/composes/${to}`;
export const needCondition = (declarer: string, need: string) => `${declarer}/needs/${need}`;

/** The caller's settled conditions, keyed by condition id. Anything absent is unknown. */
export type ConditionDecisions = ReadonlyMap<string, Exclude<ConditionState, 'unknown'>>;

/**
 * What the caller settled for an adoption. A condition's state and a selection are different
 * facts: a satisfied condition makes a conditional constituent required, but an optional
 * constituent is adopted only when selected (or requested), whatever its condition says.
 */
export interface AdoptionContext {
	conditions?: ConditionDecisions;
	/** Optional or conditional constituents the caller chose to adopt. */
	selected?: ReadonlySet<string>;
	/**
	 * Records the target already has (an equivalent existing prerequisite): reached, never built
	 * again, and not expanded — what they stand on comes with them, needs included.
	 */
	existing?: ReadonlySet<string>;
	/** Records the caller refuses: reached, never adopted, and a conflict when something requires them. */
	excluded?: ReadonlySet<string>;
}

/** A conditional or optional relationship of one whole to one constituent, with its condition's state. */
export interface Proposal {
	from: string;
	level: 'conditional' | 'optional';
	condition: Condition;
	state: ConditionState;
	inheritedFrom?: string;
}

/**
 * Why a record is a step of an adoption. `part_of` names what made it a step (`binding`):
 * `required` (a required constituent), `condition` (a conditional constituent whose condition is
 * satisfied, hence required) or `selected` (the caller selected it). `proposed` is context, not a
 * cause: the record is a step for another reason and is ALSO a conditional or optional constituent
 * of `from`.
 */
export type StepReason =
	| { kind: 'requested' }
	| { kind: 'builds_on'; from: string; inheritedFrom?: string }
	| {
			kind: 'part_of';
			from: string;
			level: ConstituentLevel;
			binding: 'required' | 'condition' | 'selected';
			condition?: Condition;
			inheritedFrom?: string;
	  }
	| ({ kind: 'proposed' } & Proposal);

/** A conditional or optional constituent that is not a step, with every whole that proposes it. */
export interface OpenConstituent {
	id: string;
	/** `conditional` when any whole needs it under a condition; otherwise `optional`. */
	level: 'conditional' | 'optional';
	/** One per proposing relationship, each with its own condition and state. */
	proposedBy: Proposal[];
}

/** A platform assumption or principle that applies to some steps of an adoption. */
export interface AppliedAssumption extends Assumption {
	kind: PatternRecord['kind'];
	/** The steps in its scope, in step order. */
	steps: string[];
}

export interface Adoption {
	/** Steps in adoption order: foundations and constituents before the records that need them. */
	steps: string[];
	/** Reached records the target already has: satisfied, not built (in registry order). */
	satisfied: string[];
	/**
	 * Reached records the caller excluded. `conflict` when a binding reason (a request, a
	 * foundation, a required or condition-required or selected constituent) needs it: the plan
	 * cannot hold both, and says so instead of dropping either.
	 */
	excluded: { id: string; conflict: boolean }[];
	cyclic: boolean;
	/** Every reason each step is in the plan, sorted; the first is its reason chain's head. */
	reasons: ReadonlyMap<string, StepReason[]>;
	/** Conditional and optional constituents that are not steps — never adopted or dropped silently. */
	open: OpenConstituent[];
	/** Generalizations whose knowledge the steps inherit (never steps themselves), per step. */
	generalizations: ReadonlyMap<string, string[]>;
	assumptions: AppliedAssumption[];
	needs: ResolvedNeed[];
}

/** One declaration that reaches a record, with the relationship path that carries it. */
export interface NeedSource {
	need: InfrastructureNeed;
	/** The record that declares it. */
	origin: string;
	/** From the resolved record to the origin, both included. */
	path: string[];
	/** The first relationship on the path (`own` for the record's own declaration). */
	via: 'own' | AdoptionRelationship;
	declaredLevel: NeedLevel;
	/** The level after the path: a conditional or optional constituent weakens what it carries. */
	level: NeedLevel;
	/** Every condition that must hold, along the path and on the declaration (a conjunction). */
	conditions: string[];
	/** The ids of those conditions. */
	conditionIds: string[];
	pinned?: string;
	why?: string;
}

export interface PinConstraint {
	technology: string;
	/** True when every source pinning it holds only under conditions. */
	conditional: boolean;
	/** For a conditional pin: each conjunction under which it holds — a conditional pin never prints as unconditional. */
	conditions: string[];
	origins: string[];
}

export interface ResolvedNeed {
	need: InfrastructureNeed;
	/** The strictest effective level of any source. */
	level: NeedLevel;
	/** For a conditional need: each distinct conjunction of conditions under which it is needed (alternatives across paths). */
	conditions: string[];
	/** The same alternatives as condition ids, for a caller that settles them. */
	conditionIds: string[][];
	pins: PinConstraint[];
	/** Every record the need comes from, the resolved record included when it declares it. */
	origins: string[];
	/**
	 * The origins that carry the need to its resolved level, when no resolved record declares it at
	 * that level itself: what the label prints as "via".
	 */
	inherited: string[];
	/** The reason of an optional or implementation need. */
	why?: string;
	/** Pins that cannot all hold with one binding: certain when two unconditional pins differ. */
	conflict: { technologies: string[]; certain: boolean } | null;
	sources: NeedSource[];
}

const strictness = (level: NeedLevel) => NEED_LEVELS.indexOf(level);
const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const unique = (values: Iterable<string>) => [...new Set(values)].sort(byText);
const conjunction = (conditions: readonly string[]) => unique(conditions).join(' and ');

/** Merge need sources into one resolved need per capability. Pure, order-independent. */
export function resolveNeeds(sources: readonly NeedSource[], roots: readonly string[] = []): ResolvedNeed[] {
	const grouped = new Map<InfrastructureNeed, NeedSource[]>();
	for (const source of sources) grouped.set(source.need, [...(grouped.get(source.need) ?? []), source]);
	const rootSet = new Set(roots);
	return [...grouped.entries()]
		.map(([need, list]) => {
			const sorted = [...list].sort((a, b) => byText(JSON.stringify(a), JSON.stringify(b)));
			const level = sorted.reduce<NeedLevel>(
				(strictest, source) => (strictness(source.level) < strictness(strictest) ? source.level : strictest),
				'implementation',
			);
			const atLevel = sorted.filter((source) => source.level === level);
			const pinned = new Map<string, NeedSource[]>();
			for (const source of sorted) {
				if (source.pinned && (source.level === 'required' || source.level === 'conditional')) {
					pinned.set(source.pinned, [...(pinned.get(source.pinned) ?? []), source]);
				}
			}
			const pins = [...pinned.entries()]
				.map(([technology, pinSources]) => {
					const conditional = pinSources.every((source) => source.level === 'conditional');
					return {
						technology,
						conditional,
						conditions: conditional ? unique(pinSources.map((source) => conjunction(source.conditions))) : [],
						origins: unique(pinSources.map((source) => source.origin)),
					};
				})
				.sort((a, b) => byText(a.technology, b.technology));
			const unconditional = pins.filter((pin) => !pin.conditional).map((pin) => pin.technology);
			const origins = unique(sorted.map((source) => source.origin));
			return {
				need,
				level,
				conditions: level === 'conditional' ? unique(atLevel.map((source) => conjunction(source.conditions))) : [],
				conditionIds:
					level === 'conditional'
						? [...new Map(atLevel.map((source) => [source.conditionIds.join(' & '), source.conditionIds])).entries()]
								.sort(([a], [b]) => byText(a, b))
								.map(([, ids]) => ids)
						: [],
				pins,
				origins,
				// What explains the level: the origins that carry it there. A root that declares the
				// need at that level explains it itself, so nothing prints as "via".
				inherited: atLevel.some((source) => rootSet.has(source.origin))
					? []
					: unique(atLevel.map((source) => source.origin)).filter((origin) => !rootSet.has(origin)),
				why: level === 'optional' || level === 'implementation' ? atLevel.find((source) => source.why)?.why : undefined,
				conflict:
					pins.length > 1
						? { technologies: pins.map((pin) => pin.technology), certain: unconditional.length > 1 }
						: null,
				sources: sorted,
			};
		})
		.sort((a, b) => strictness(a.level) - strictness(b.level) || byText(a.need, b.need));
}

export interface PatternGraph {
	readonly registry: Registry;
	readonly byId: ReadonlyMap<string, PatternRecord>;
	/** Authored edges leaving a record, in field order, optionally of one type. */
	edgesFrom(id: string, type?: RelationshipType): Edge[];
	/** Derived inverse: authored edges arriving at a record, sorted by source. */
	edgesTo(id: string, type?: RelationshipType): Edge[];
	/** The specialization chain upward: parent, grandparent, … */
	generalizations(id: string): string[];
	/** Invariants that hold in a record because it specializes another, per generalization. */
	inheritedInvariants(id: string): { from: string; invariants: string[] }[];
	/** The record's own adoption edges plus those inherited from its generalizations. */
	effectiveEdges(id: string): EffectiveEdge[];
	/** A record's adoption needs with every condition unknown. */
	needs(id: string): ResolvedNeed[];
	/** The need sources that reach a record, before merging, under the caller's settled conditions and selections. */
	needSources(id: string, context?: AdoptionContext): NeedSource[];
	/** Every condition a record's adoption can meet, along its effective edges and need declarations, sorted by id. */
	conditionsOf(id: string): Condition[];
	/** Assumptions whose scope contains the record, unless the record adopts the assumed record itself. */
	assumptionsFor(id: string): Assumption[];
	/** The adoption closure of the requested records under the caller's settled conditions and selections. */
	adopt(requested: readonly string[], context?: AdoptionContext): Adoption;
	/** Kahn order over effective adoption edges inside `ids`; ties by registry order. */
	order(ids: readonly string[]): { order: string[]; cyclic: boolean };
}

export function patternGraph(registry: Registry): PatternGraph {
	const byId = new Map(registry.patterns.map((pattern) => [pattern.id, pattern]));
	const rank = new Map(registry.patterns.map((pattern, index) => [pattern.id, index]));
	const byRank = (a: string, b: string) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0);

	const authored = (pattern: PatternRecord): Edge[] => [
		...pattern.builds_on.map((entry) => ({
			type: 'builds_on' as const,
			from: pattern.id,
			to: entry.id,
			why: entry.why,
		})),
		...pattern.composes.map((entry) => ({
			type: 'composes' as const,
			from: pattern.id,
			to: entry.id,
			why: entry.why,
			level: entry.level,
			...(entry.when ? { when: entry.when } : {}),
		})),
		...(pattern.specializes
			? [{ type: 'specializes' as const, from: pattern.id, to: pattern.specializes.id, why: pattern.specializes.why }]
			: []),
		...pattern.references.map((entry) => ({
			type: 'references' as const,
			from: pattern.id,
			to: entry.id,
			why: entry.why,
		})),
	];
	const outgoing = new Map(registry.patterns.map((pattern) => [pattern.id, authored(pattern)]));
	const incoming = new Map<string, Edge[]>();
	for (const edges of outgoing.values()) {
		for (const edge of edges) incoming.set(edge.to, [...(incoming.get(edge.to) ?? []), edge]);
	}

	const edgesFrom = (id: string, type?: RelationshipType) =>
		(outgoing.get(id) ?? []).filter((edge) => type === undefined || edge.type === type);
	const edgesTo = (id: string, type?: RelationshipType) =>
		(incoming.get(id) ?? [])
			.filter((edge) => type === undefined || edge.type === type)
			.sort((a, b) => byRank(a.from, b.from) || byText(a.type, b.type));

	const generalizations = (id: string): string[] => {
		const chain: string[] = [];
		let current = byId.get(id)?.specializes?.id;
		while (current && !chain.includes(current) && current !== id) {
			chain.push(current);
			current = byId.get(current)?.specializes?.id;
		}
		return chain;
	};

	const effectiveEdges = (id: string): EffectiveEdge[] => {
		const own = edgesFrom(id).filter(
			(edge): edge is EffectiveEdge => edge.type === 'builds_on' || edge.type === 'composes',
		);
		// Only an adoption edge replaces an inherited one: a reference is planning-neutral and never
		// suppresses a foundation or constituent the generalization requires.
		const covered = new Set([id, ...own.map((edge) => edge.to)]);
		const inherited: EffectiveEdge[] = [];
		for (const parent of generalizations(id)) {
			covered.add(parent);
			for (const edge of edgesFrom(parent)) {
				if ((edge.type !== 'builds_on' && edge.type !== 'composes') || covered.has(edge.to)) continue;
				covered.add(edge.to);
				inherited.push({ ...edge, type: edge.type, from: id, inheritedFrom: parent });
			}
		}
		return [...own, ...inherited];
	};

	/** The condition an effective conditional or optional edge carries: its authoring whole's. */
	const edgeCondition = (edge: EffectiveEdge): Condition => {
		const from = edge.inheritedFrom ?? edge.from;
		return {
			id: compositionCondition(from, edge.to),
			when: edge.when ?? '',
			origin: { kind: 'composes', from, to: edge.to },
		};
	};
	const declarationCondition = (declarer: string, need: InfrastructureNeed, when: string): Condition => ({
		id: needCondition(declarer, need),
		when,
		origin: { kind: 'need', declarer, need },
	});

	/**
	 * Every need declaration reaching `root`, by path. A record contributes its own declarations and
	 * those of its generalizations (all but implementation needs); its effective edges carry the
	 * walk on. Conditions accumulate along conditional and optional composition (a conjunction per
	 * path), and an optional constituent makes everything it carries optional. Settled by id:
	 * an unsatisfied condition removes what it governs; a satisfied one on a conditional
	 * constituent or a conditional need makes it required; a satisfied one on an optional
	 * constituent leaves it optional — only a selection adopts it.
	 */
	const needSources = (root: string, context: AdoptionContext = {}): NeedSource[] => {
		const decisions: ConditionDecisions = context.conditions ?? new Map();
		const selected = context.selected ?? new Set<string>();
		const stops = new Set([...(context.existing ?? []), ...(context.excluded ?? [])]);
		const sources: NeedSource[] = [];
		const declare = (
			declarer: string,
			path: string[],
			conditions: Condition[],
			optional: boolean,
			via: NeedSource['via'],
			fromGeneralization: boolean,
		) => {
			for (const entry of byId.get(declarer)?.needs ?? []) {
				const declaration = needDeclaration(entry);
				const carried =
					declarer === root ||
					declaration.level === 'required' ||
					declaration.level === 'conditional' ||
					(fromGeneralization && declaration.level === 'optional');
				if (!carried) continue;
				let settled: NeedLevel = declaration.level;
				const own: Condition[] = [];
				if (declaration.level === 'conditional' && declaration.when) {
					const condition = declarationCondition(declarer, declaration.need, declaration.when);
					const state = decisions.get(condition.id);
					if (state === 'unsatisfied') continue;
					if (state === 'satisfied') settled = 'required';
					else own.push(condition);
				}
				const all = [...conditions, ...own];
				let level: NeedLevel = settled;
				if (optional && (level === 'required' || level === 'conditional')) level = 'optional';
				else if (level === 'required' && all.length > 0) level = 'conditional';
				const whens = unique(all.map((condition) => condition.when));
				const why =
					declaration.why ??
					(optional
						? `part of an optional constituent (${path.slice(1).join(' → ')})${whens.length > 0 ? ` when ${conjunction(whens)}` : ''}`
						: undefined);
				sources.push({
					need: declaration.need,
					origin: declarer,
					path,
					via,
					declaredLevel: declaration.level,
					level,
					conditions: whens,
					conditionIds: unique(all.map((condition) => condition.id)),
					...(declaration.pinned ? { pinned: declaration.pinned } : {}),
					...(why ? { why } : {}),
				});
			}
		};
		const walk = (id: string, path: string[], conditions: Condition[], optional: boolean, via: NeedSource['via']) => {
			declare(id, path, conditions, optional, via, false);
			for (const parent of generalizations(id)) {
				declare(parent, [...path, parent], conditions, optional, id === root ? 'specializes' : via, true);
			}
			for (const edge of effectiveEdges(id)) {
				// A record the target has brings its own needs; an excluded one brings none.
				if (path.includes(edge.to) || stops.has(edge.to)) continue;
				const nextVia: NeedSource['via'] = id === root ? edge.type : via;
				const next = [...path, ...(edge.inheritedFrom ? [edge.inheritedFrom] : []), edge.to];
				const level = edge.type === 'builds_on' ? 'required' : (edge.level ?? 'required');
				// A required constituent, and a selected one (adopted by the caller), carry their needs whole.
				if (level === 'required' || selected.has(edge.to)) {
					walk(edge.to, next, conditions, optional, nextVia);
					continue;
				}
				const condition = edgeCondition(edge);
				const state = decisions.get(condition.id) ?? 'unknown';
				if (state === 'unsatisfied') continue;
				if (level === 'conditional') {
					walk(edge.to, next, state === 'satisfied' ? conditions : [...conditions, condition], optional, nextVia);
				} else {
					// Optional: a satisfied condition makes it applicable, not adopted — its needs stay optional.
					walk(edge.to, next, state === 'satisfied' ? conditions : [...conditions, condition], true, nextVia);
				}
			}
		};
		walk(root, [root], [], false, 'own');
		return sources;
	};

	const conditionsOf = (root: string): Condition[] => {
		const found = new Map<string, Condition>();
		const seen = new Set<string>();
		const visit = (id: string) => {
			if (seen.has(id)) return;
			seen.add(id);
			for (const declarer of [id, ...generalizations(id)]) {
				for (const entry of byId.get(declarer)?.needs ?? []) {
					const declaration = needDeclaration(entry);
					if (declaration.level !== 'conditional' || !declaration.when) continue;
					const condition = declarationCondition(declarer, declaration.need, declaration.when);
					found.set(condition.id, condition);
				}
			}
			for (const edge of effectiveEdges(id)) {
				if (edge.type === 'composes' && edge.level !== 'required') {
					const condition = edgeCondition(edge);
					found.set(condition.id, condition);
				}
				visit(edge.to);
			}
		};
		visit(root);
		return [...found.values()].sort((a, b) => byText(a.id, b.id));
	};

	const assumptionsFor = (id: string): Assumption[] => {
		const pattern = byId.get(id);
		if (!pattern) return [];
		const adopted = new Set(effectiveEdges(id).map((edge) => edge.to));
		return registry.assumptions.filter(
			(assumption) => assumption.id !== id && !adopted.has(assumption.id) && inScope(pattern, assumption.applies_to),
		);
	};

	const order = (ids: readonly string[]) => {
		const inSet = new Set(ids);
		const prerequisites = (id: string) =>
			unique(effectiveEdges(id).map((edge) => edge.to)).filter((to) => inSet.has(to) && to !== id);
		const done: string[] = [];
		const placed = new Set<string>();
		let ready = [...inSet].filter((id) => prerequisites(id).length === 0).sort(byRank);
		while (ready.length > 0) {
			const next = ready.shift() as string;
			done.push(next);
			placed.add(next);
			const unlocked = [...inSet].filter(
				(id) => !placed.has(id) && !ready.includes(id) && prerequisites(id).every((dep) => placed.has(dep)),
			);
			ready = [...ready, ...unlocked].sort(byRank);
		}
		const cyclic = done.length < inSet.size;
		if (cyclic) done.push(...[...inSet].filter((id) => !placed.has(id)).sort(byRank));
		return { order: done, cyclic };
	};

	const adopt = (requested: readonly string[], context: AdoptionContext = {}): Adoption => {
		const decisions: ConditionDecisions = context.conditions ?? new Map();
		const selected = context.selected ?? new Set<string>();
		const existing = context.existing ?? new Set<string>();
		const excluded = context.excluded ?? new Set<string>();
		const reasons = new Map<string, StepReason[]>();
		const proposals = new Map<string, Proposal[]>();
		const queue: { id: string; reason: StepReason }[] = unique(requested)
			.filter((id) => byId.has(id))
			.map((id) => ({ id, reason: { kind: 'requested' } }));
		while (queue.length > 0) {
			const { id, reason } = queue.shift() as { id: string; reason: StepReason };
			const known = reasons.get(id);
			if (known) {
				known.push(reason);
				continue;
			}
			reasons.set(id, [reason]);
			if (existing.has(id) || excluded.has(id)) continue;
			for (const edge of effectiveEdges(id)) {
				const inherited = edge.inheritedFrom ? { inheritedFrom: edge.inheritedFrom } : {};
				if (edge.type === 'builds_on') {
					queue.push({ id: edge.to, reason: { kind: 'builds_on', from: id, ...inherited } });
					continue;
				}
				const level = edge.level ?? 'required';
				if (level === 'required') {
					queue.push({ id: edge.to, reason: { kind: 'part_of', from: id, level, binding: 'required', ...inherited } });
					continue;
				}
				const condition = edgeCondition(edge);
				const state = decisions.get(condition.id) ?? 'unknown';
				if (selected.has(edge.to)) {
					queue.push({
						id: edge.to,
						reason: { kind: 'part_of', from: id, level, binding: 'selected', condition, ...inherited },
					});
				} else if (level === 'conditional' && state === 'satisfied') {
					queue.push({
						id: edge.to,
						reason: { kind: 'part_of', from: id, level, binding: 'condition', condition, ...inherited },
					});
				} else {
					proposals.set(edge.to, [
						...(proposals.get(edge.to) ?? []),
						{ from: id, level, condition, state, ...inherited },
					]);
				}
			}
		}
		// A proposal whose constituent is a step anyway stays visible as context of that step.
		for (const [id, list] of proposals) {
			const known = reasons.get(id);
			if (known) for (const proposal of list) known.push({ kind: 'proposed', ...proposal });
		}
		const head = (reason: StepReason) =>
			reason.kind === 'requested'
				? '0'
				: reason.kind === 'proposed'
					? `2${reason.from}`
					: `1${reason.kind}:${reason.from}`;
		const sortReasons = (list: StepReason[]) =>
			[...list].sort((a, b) => byText(head(a), head(b)) || byText(JSON.stringify(a), JSON.stringify(b)));
		const sortedReasons = new Map([...reasons.entries()].map(([id, list]) => [id, sortReasons(list)]));
		const { order: steps, cyclic } = order([...reasons.keys()].filter((id) => !existing.has(id) && !excluded.has(id)));
		const binds = (reason: StepReason) => reason.kind !== 'proposed';
		const open: OpenConstituent[] = [...proposals.entries()]
			.filter(([id]) => !reasons.has(id) && !excluded.has(id))
			.map(([id, proposedBy]) => ({
				id,
				level: proposedBy.some((entry) => entry.level === 'conditional')
					? ('conditional' as const)
					: ('optional' as const),
				proposedBy: [...proposedBy].sort((a, b) => byRank(a.from, b.from) || byText(a.condition.id, b.condition.id)),
			}))
			.sort((a, b) => byRank(a.id, b.id));
		const stepSet = new Set(steps);
		const assumptions: AppliedAssumption[] = registry.assumptions
			.filter((assumption) => !stepSet.has(assumption.id))
			.map((assumption) => ({
				...assumption,
				kind: byId.get(assumption.id)?.kind ?? 'pattern',
				steps: steps.filter((id) => assumptionsFor(id).some((entry) => entry.id === assumption.id)),
			}))
			.filter((assumption) => assumption.steps.length > 0);
		return {
			steps,
			satisfied: [...reasons.keys()].filter((id) => existing.has(id) && !excluded.has(id)).sort(byRank),
			excluded: [...new Set([...reasons.keys(), ...proposals.keys()])]
				.filter((id) => excluded.has(id))
				.sort(byRank)
				.map((id) => ({ id, conflict: (reasons.get(id) ?? []).some(binds) })),
			cyclic,
			reasons: sortedReasons,
			open,
			generalizations: new Map(steps.map((id) => [id, generalizations(id)])),
			assumptions,
			needs: resolveNeeds(
				steps.flatMap((id) => needSources(id, context)),
				steps,
			),
		};
	};

	return {
		registry,
		byId,
		edgesFrom,
		edgesTo,
		generalizations,
		inheritedInvariants: (id) =>
			generalizations(id)
				.map((from) => ({ from, invariants: [...(byId.get(from)?.invariants ?? [])] }))
				.filter((entry) => entry.invariants.length > 0),
		effectiveEdges,
		needs: (id) => resolveNeeds(needSources(id), [id]),
		needSources,
		conditionsOf,
		assumptionsFor,
		adopt,
		order,
	};
}

const graphs = new WeakMap<Registry, PatternGraph>();

/** The graph of a registry object, built once and shared by every reader of that object. */
export function graphOf(registry: Registry): PatternGraph {
	let graph = graphs.get(registry);
	if (!graph) {
		graph = patternGraph(registry);
		graphs.set(registry, graph);
	}
	return graph;
}

/** The adoption targets a record authors, re-exported for readers that only need ids. */
export { adoptionTargets };
