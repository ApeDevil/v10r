/**
 * The emulation planner in three stages with one contract each (Slice 4):
 *
 * 1. **Discovery** (`discover`) — natural language in, candidates out. It reads names, ids,
 *    provided capabilities, keywords and the rest of a record's text through the one scorer
 *    (`search.ts`) and says WHICH kind of evidence matched: a name (id or title), a capability the
 *    record declares it provides, a keyword (a related term, not a promise), or other text.
 * 2. **Selection** (`select`) — one candidate per request, or an explicit ambiguity. Every tier
 *    and kind is eligible (a light record is a record, not a lesser answer); no runner-up is
 *    adopted because its score is close; when the evidence does not single out one record, the
 *    answer is the candidates, the reason, and a recovery call with exact ids. Canonical ids skip
 *    discovery: they are validated, never resolved through aliases.
 * 3. **Assembly** (`assemble`) — canonical ids in, a plan out, deterministically, through the
 *    shared graph (`pattern-graph.ts`) and nothing else: prerequisites, constituents at every
 *    level, specializations, principles, assumptions, needs, pins, order, conflicts, provenance.
 *    Assembly never reads the natural-language request.
 *
 * Framework-free and filesystem-free, like every module the offline MCP bundle carries.
 */
import { targetProvides } from './infrastructure-needs.ts';
import {
	type Adoption,
	type AppliedAssumption,
	type Condition,
	type ConditionDecisions,
	graphOf,
	type ResolvedNeed,
	resolveNeeds,
	type StepReason,
} from './pattern-graph.ts';
import type { EntityKind, PatternRecord, PatternTier, Registry } from './schema.ts';
import { patternTerms, type Scored, scorePatterns } from './search.ts';

// ── Discovery ────────────────────────────────────────────────────────────────

/** What matched, strongest first: a name is a lookup; a capability a promise; a keyword only a related term. */
export const EVIDENCE = ['name', 'capability', 'keyword', 'text'] as const;
export type Evidence = (typeof EVIDENCE)[number];

export interface Candidate {
	id: string;
	title: string;
	kind: EntityKind;
	tier: PatternTier;
	score: number;
	strength: Scored['strength'];
	evidence: Evidence;
	/** The declared capability, keyword, or field names that matched. */
	matched: string[];
	/** The request says all of the matched phrase (otherwise the request is inside it). */
	complete: boolean;
	/** The request IS its id or title: a lookup, chosen over any other candidate. */
	exact: boolean;
}

/**
 * How a phrase of the record meets the request: `complete` when the request says all of it
 * ("stampede protection" in "cache stampede protection"), `partial` when the whole request is
 * inside it ("jobs" in "background jobs"), otherwise not at all.
 */
function phraseFit(phrase: string, terms: ReadonlySet<string>): 'complete' | 'partial' | null {
	const own = patternTerms(phrase);
	if (own.length === 0 || terms.size === 0) return null;
	if (own.every((term) => terms.has(term))) return 'complete';
	return [...terms].every((term) => own.includes(term)) ? 'partial' : null;
}

/**
 * The strongest evidence, in this order: a complete name, a complete declared capability, a
 * partial name, a partial capability, a keyword (complete, then partial), other text. A keyword
 * is a related term, never a promise, so it never outranks a capability or a name.
 */
const EVIDENCE_ORDER = [
	['name', true],
	['capability', true],
	['name', false],
	['capability', false],
	['keyword', true],
	['keyword', false],
	['text', false],
] as const;

function evidenceOf(request: string, hit: Scored): { evidence: Evidence; complete: boolean; matched: string[] } {
	const pattern = hit.pattern;
	const terms = new Set(patternTerms(request));
	const asId = request.trim().toLowerCase().replace(/\s+/g, '-');
	const bareId = pattern.id.startsWith(`${pattern.category}-`)
		? pattern.id.slice(pattern.category.length + 1)
		: pattern.id;
	const fits = (phrases: readonly string[]) => {
		const fitted = phrases.map((phrase) => ({ phrase, fit: phraseFit(phrase, terms) }));
		const complete = fitted.filter((entry) => entry.fit === 'complete').map((entry) => entry.phrase);
		const partial = fitted.filter((entry) => entry.fit === 'partial').map((entry) => entry.phrase);
		return { complete, partial };
	};
	const name = fits([pattern.title, bareId.replace(/-/g, ' ')]);
	const capability = fits(pattern.capabilities);
	const keyword = fits(pattern.keywords);
	if (pattern.id === asId) name.complete.unshift(pattern.title);
	const found: Record<Evidence, { complete: string[]; partial: string[] }> = {
		name: { complete: name.complete.slice(0, 1), partial: name.partial.slice(0, 1) },
		capability,
		keyword,
		text: { complete: [], partial: hit.matchedFields },
	};
	for (const [evidence, complete] of EVIDENCE_ORDER) {
		const matched = complete ? found[evidence].complete : found[evidence].partial;
		if (matched.length > 0) return { evidence, complete, matched };
	}
	return { evidence: 'text', complete: false, matched: [] };
}

/** Ranked candidates for one request; weak overlaps are kept, graded, never selected. */
export function discover(registry: Registry, request: string, limit = 5): Candidate[] {
	return scorePatterns(request, registry.patterns)
		.slice(0, limit)
		.map((hit) => ({
			exact:
				hit.pattern.id === request.trim().toLowerCase().replace(/\s+/g, '-') ||
				hit.pattern.title.toLowerCase() === request.trim().toLowerCase(),
			id: hit.pattern.id,
			title: hit.pattern.title,
			kind: hit.pattern.kind,
			tier: hit.pattern.tier,
			score: hit.score,
			strength: hit.strength,
			...evidenceOf(request, hit),
		}));
}

// ── Selection ────────────────────────────────────────────────────────────────

/**
 * A runner-up within this share of the best score, with evidence as strong, makes the request
 * ambiguous — unless one already adopts the other (asking for a part names the whole's need).
 */
export const AMBIGUITY_RATIO = 0.75;
const rankOf = (candidate: Pick<Candidate, 'evidence' | 'complete'>) =>
	EVIDENCE_ORDER.findIndex(
		([evidence, complete]) =>
			evidence === candidate.evidence && (complete === candidate.complete || evidence === 'text'),
	);

export type Selection =
	| { request: string; status: 'selected'; chosen: Candidate; reason: string }
	| { request: string; status: 'ambiguous'; candidates: Candidate[]; reason: string }
	| { request: string; status: 'unmatched'; closest: Candidate | null; reason: string };

export function select(registry: Registry, request: string): Selection {
	const all = discover(registry, request);
	const eligible = all.filter((candidate) => candidate.strength !== 'weak');
	// The strongest evidence first — a declared capability outranks a louder keyword match — then score.
	const [best, ...rest] = [...eligible].sort(
		(a, b) => Number(b.exact) - Number(a.exact) || rankOf(a) - rankOf(b) || b.score - a.score || (a.id < b.id ? -1 : 1),
	);
	if (!best) {
		return {
			request,
			status: 'unmatched',
			closest: all[0] ?? null,
			reason: all[0] ? 'only weak overlaps: no record answers the whole request' : 'nothing in the registry matches',
		};
	}
	const graph = graphOf(registry);
	const adopts = (whole: string, part: string) => graph.adopt([whole]).steps.includes(part);
	const rivals = rest.filter(
		(other) =>
			other.score >= best.score * AMBIGUITY_RATIO &&
			rankOf(other) === rankOf(best) &&
			!adopts(best.id, other.id) &&
			!adopts(other.id, best.id),
	);
	// Matched only on descriptions, with company: nothing names the request — say so instead of guessing.
	if (!best.exact && best.evidence === 'text' && best.strength !== 'strong' && rest.length > 0) {
		return {
			request,
			status: 'ambiguous',
			candidates: [best, ...rest].slice(0, 4),
			reason: 'no record names it or declares it as a capability or keyword, and the best description match covers only part of the request',
		};
	}
	// When the leader stands on another record that declares the same evidence, that record is
	// what provides it: the request names the part, and the whole would only add what it builds on.
	if (!best.exact && rivals.length === 0) {
		const part = rest.find(
			(other) => rankOf(other) === rankOf(best) && adopts(best.id, other.id) && !adopts(other.id, best.id),
		);
		if (part) {
			return {
				request,
				status: 'selected',
				chosen: part,
				reason: `its ${part.evidence === 'capability' ? `declared capability "${part.matched[0]}"` : part.evidence} matches; \`${best.id}\` matches as well but builds on it, so this record is what provides it`,
			};
		}
	}
	if (rivals.length === 0 || best.exact) {
		return {
			request,
			status: 'selected',
			chosen: best,
			reason: best.exact
				? 'the request is its exact id or title'
				: `${best.evidence === 'name' ? 'its name' : best.evidence === 'capability' ? `its declared capability "${best.matched[0]}"` : best.evidence === 'keyword' ? `its keyword "${best.matched[0]}"` : 'its description'} matches, and no other record matches with evidence as strong`,
		};
	}
	return {
		request,
		status: 'ambiguous',
		candidates: [best, ...rivals].slice(0, 4),
		reason: `${rivals.length + 1} records match about equally (${[best, ...rivals]
			.slice(0, 4)
			.map((candidate) => `${candidate.id}: ${candidate.evidence}`)
			.join(', ')}) and none adopts another`,
	};
}

// ── Assembly ─────────────────────────────────────────────────────────────────

export interface TargetDescription {
	/** Infrastructure the target has (need ids or technologies); null = not described, everything unknown. */
	provides: ReadonlySet<string> | null;
	/** Infrastructure the target is known to lack. Anything in neither list is unknown, never absent. */
	lacks: ReadonlySet<string>;
	/** Records the target already has an equivalent of: satisfied, never built again. */
	existing: ReadonlySet<string>;
}

export interface AssemblyRequest {
	/** Canonical ids, each with what asked for it: `id` (the caller named it) or the capability request. */
	roots: ReadonlyMap<string, readonly string[]>;
	conditions: ConditionDecisions;
	selected: ReadonlySet<string>;
	excluded: ReadonlySet<string>;
	target: TargetDescription;
}

export type StepAction = 'implement' | 'perform';

export interface PlanStep {
	id: string;
	kind: EntityKind;
	tier: PatternTier;
	/** A pattern is implemented; a workflow is a procedure performed against the project. */
	action: StepAction;
	requestedAs: readonly string[];
	reasons: StepReason[];
	generalizations: string[];
	/** What adopting this step takes, under the caller's settled conditions. */
	needs: ResolvedNeed[];
	/** Required needs it declares (itself or through a generalization) that the target lacks. */
	blockedBy: ResolvedNeed[];
	/** Requested or adopted steps that stand on a blocked step (transitively). */
	affects: string[];
}

export type NeedStatus = 'provided' | 'lacking' | 'unknown' | 'pin-mismatch';

export interface Plan {
	roots: { id: string; requestedAs: readonly string[] }[];
	/** Requested principles: they constrain the work and are never steps. */
	requestedPrinciples: string[];
	steps: PlanStep[];
	adoption: Adoption;
	principles: AppliedAssumption[];
	conventions: AppliedAssumption[];
	needs: { need: ResolvedNeed; status: NeedStatus | null }[];
	/** Conditions this plan meets that the caller has not settled, by id. */
	unresolved: Condition[];
	/** Condition ids the caller settled that this plan does not meet. */
	irrelevantConditions: string[];
	/** Selected or excluded ids that are not records. */
	unknownIds: string[];
	blocked: PlanStep[];
}

export function assemble(registry: Registry, request: AssemblyRequest): Plan {
	const graph = graphOf(registry);
	const known = (id: string) => graph.byId.has(id);
	const rootIds = [...request.roots.keys()].filter(known);
	const requestedPrinciples = rootIds.filter((id) => graph.byId.get(id)?.kind === 'principle');
	const adoptable = rootIds.filter((id) => !requestedPrinciples.includes(id));
	const context = {
		conditions: request.conditions,
		selected: request.selected,
		existing: request.target.existing,
		excluded: request.excluded,
	};
	const adoption: Adoption = graph.adopt(adoptable, context);
	const target = request.target;
	const statusOf = (need: ResolvedNeed): NeedStatus | null => {
		if (target.lacks.has(need.need)) return 'lacking';
		if (target.provides === null) return target.lacks.size > 0 ? 'unknown' : null;
		const fit = targetProvides(target.provides, need);
		if (fit.provided) return 'provided';
		return fit.pinMismatch ? 'pin-mismatch' : 'unknown';
	};
	const stepNeeds = new Map(
		adoption.steps.map((id) => [id, resolveNeeds(graph.needSources(id, context), [id])] as const),
	);
	// A step is blocked by a required need it carries itself (or through its generalization) that the
	// target lacks; what stands on it is affected, never silently kept or dropped.
	const ownOrigins = (id: string) => new Set([id, ...graph.generalizations(id)]);
	const blockedBy = new Map(
		adoption.steps.map((id) => {
			const origins = ownOrigins(id);
			return [
				id,
				(stepNeeds.get(id) ?? []).filter(
					(need) =>
						need.level === 'required' &&
						need.sources.some((source) => source.level === 'required' && origins.has(source.origin)) &&
						(statusOf(need) === 'lacking' || statusOf(need) === 'pin-mismatch'),
				),
			] as const;
		}),
	);
	const dependents = (id: string): string[] => {
		const found = new Set<string>();
		const visit = (current: string) => {
			for (const reason of adoption.reasons.get(current) ?? []) {
				if ((reason.kind === 'builds_on' || reason.kind === 'part_of') && !found.has(reason.from)) {
					found.add(reason.from);
					visit(reason.from);
				}
			}
		};
		visit(id);
		return adoption.steps.filter((step) => found.has(step));
	};
	const steps: PlanStep[] = adoption.steps.map((id) => {
		const record = graph.byId.get(id) as PatternRecord;
		const blocked = blockedBy.get(id) ?? [];
		return {
			id,
			kind: record.kind,
			tier: record.tier,
			action: record.kind === 'workflow' ? 'perform' : 'implement',
			requestedAs: request.roots.get(id) ?? [],
			reasons: adoption.reasons.get(id) ?? [],
			generalizations: adoption.generalizations.get(id) ?? [],
			needs: stepNeeds.get(id) ?? [],
			blockedBy: blocked,
			affects: blocked.length > 0 ? dependents(id) : [],
		};
	});
	const met = new Map<string, Condition>();
	for (const id of [...adoption.steps])
		for (const condition of graph.conditionsOf(id)) met.set(condition.id, condition);
	for (const entry of adoption.open)
		for (const proposal of entry.proposedBy) met.set(proposal.condition.id, proposal.condition);
	const unresolved = [...met.values()]
		.filter((condition) => !request.conditions.has(condition.id))
		.filter(
			(condition) =>
				// A condition under a settled or adopted path is moot once its constituent is a step.
				condition.origin.kind === 'need' || !adoption.steps.includes(condition.origin.to),
		)
		.sort((a, b) => (a.id < b.id ? -1 : 1));
	return {
		roots: rootIds.map((id) => ({ id, requestedAs: request.roots.get(id) ?? [] })),
		requestedPrinciples,
		steps,
		adoption,
		principles: adoption.assumptions.filter((entry) => entry.kind === 'principle'),
		conventions: adoption.assumptions.filter((entry) => entry.kind !== 'principle'),
		needs: adoption.needs.map((need) => ({ need, status: statusOf(need) })),
		unresolved,
		irrelevantConditions: [...request.conditions.keys()].filter((id) => !met.has(id)).sort(),
		unknownIds: [...request.selected, ...request.excluded, ...request.target.existing].filter((id) => !known(id)),
		blocked: steps.filter((step) => step.blockedBy.length > 0),
	};
}
