/**
 * The decision engine: a workload profile in, one recommendation per decision out.
 *
 * Deterministic and explainable by construction — there is no score. For each decision the
 * rules are read in order:
 *
 *   - a rule whose every named factor is known and matches **fires**: its alternative is
 *     chosen and its `because` is the explanation;
 *   - a rule that would match except that a factor it names is `unknown` is **undecided**:
 *     it is reported as missing information ("if `background` were `required`, this would
 *     choose `background-job`") and the engine reads on;
 *   - a rule contradicted by a known value is skipped;
 *   - no rule fires → the decision's fallback, which is by policy its simplest alternative.
 *
 * Undecided rules are only reported when they sit *before* the rule that fired (or when no
 * rule fired): a later rule can never override an earlier one, so it cannot change the result.
 * The same profile and the same catalogue revision always produce the same output.
 */
import type {
	ArchitectureDecision,
	ArchitectureDecisionCatalog,
	DecisionAlternative,
	DecisionEvidence,
	DecisionRule,
} from './decision-record.ts';
import {
	isFactorValue,
	UNKNOWN,
	WORKLOAD_FACTOR_IDS,
	type WorkloadFactor,
	type WorkloadProfile,
} from './vocabulary.ts';

/** Bumps whenever the evaluation semantics above change. Recorded in every recommendation. */
export const EXPLORE_ENGINE_REVISION = 1;

/** A rule that could change the outcome if the named factors were known. */
export interface MissingInformation {
	rule: string;
	factors: WorkloadFactor[];
	/** The alternative the rule would choose. */
	would_choose: string;
	because: string;
}

/** A rule that would have chosen this alternative, and the known input that rules it out. */
export interface RuleContradiction {
	rule: string;
	factor: WorkloadFactor;
	needs: string[];
	actual: string;
}

export interface AlternativeOutcome {
	alternative: DecisionAlternative;
	/** Rules for this alternative that a known input contradicts — the concrete reason it lost. */
	contradicted_by: RuleContradiction[];
	/** True when a rule for it was only blocked by an unknown factor (see `missing`). */
	reachable_with_more_information: boolean;
	/** True when the chosen alternative won by an earlier rule while a later rule for this one also matched. */
	outranked: boolean;
}

export interface DecisionOutcome {
	decision: string;
	decision_revision: number;
	domain: ArchitectureDecision['domain'];
	title: string;
	question: string;
	chosen: DecisionAlternative;
	/** `rule` = a rule fired on known inputs; `fallback` = nothing fired, the simplest option applies. */
	basis: 'rule' | 'fallback';
	rule?: string;
	because: string;
	/** The known factor values the fired rule depended on. */
	inputs_used: Partial<Record<WorkloadFactor, string>>;
	alternatives: AlternativeOutcome[];
	missing: MissingInformation[];
	changes_when: string[];
	evidence: DecisionEvidence[];
}

export interface ArchitectureRecommendation {
	engine_revision: number;
	catalog_format: number;
	profile: WorkloadProfile;
	/** Factors left `unknown`, in factor order. */
	unknown_factors: WorkloadFactor[];
	outcomes: DecisionOutcome[];
}

type RuleState =
	| { state: 'fires' }
	| { state: 'skipped'; contradiction: Omit<RuleContradiction, 'rule'> }
	| { state: 'undecided'; factors: WorkloadFactor[] };

function evaluateRule(rule: DecisionRule, profile: WorkloadProfile): RuleState {
	const unknownFactors: WorkloadFactor[] = [];
	for (const factor of WORKLOAD_FACTOR_IDS) {
		const allowed = rule.when[factor];
		if (!allowed) continue;
		const value = profile[factor];
		if (value === UNKNOWN) unknownFactors.push(factor);
		else if (!allowed.includes(value)) {
			return { state: 'skipped', contradiction: { factor, needs: [...allowed], actual: value } };
		}
	}
	return unknownFactors.length > 0 ? { state: 'undecided', factors: unknownFactors } : { state: 'fires' };
}

function alternativeById(decision: ArchitectureDecision, id: string): DecisionAlternative {
	const found = decision.alternatives.find((alternative) => alternative.id === id);
	// parseDecisionCatalog guarantees every `choose` names an alternative.
	if (!found) throw new Error(`decision ${decision.id}: unknown alternative ${id}`);
	return found;
}

export function evaluateDecision(decision: ArchitectureDecision, profile: WorkloadProfile): DecisionOutcome {
	const missing: MissingInformation[] = [];
	let fired: DecisionRule | undefined;
	for (const rule of decision.rules) {
		const result = evaluateRule(rule, profile);
		if (result.state === 'fires') {
			fired = rule;
			break;
		}
		if (result.state === 'undecided') {
			missing.push({ rule: rule.id, factors: result.factors, would_choose: rule.choose, because: rule.because });
		}
	}
	const chosenId = fired ? fired.choose : decision.fallback.choose;
	const chosen = alternativeById(decision, chosenId);
	const because = fired ? fired.because : decision.fallback.because;
	const inputsUsed: Partial<Record<WorkloadFactor, string>> = {};
	if (fired) {
		for (const factor of WORKLOAD_FACTOR_IDS) {
			if (fired.when[factor]) inputsUsed[factor] = profile[factor];
		}
	}
	const relevantMissing = missing.filter((entry) => entry.would_choose !== chosenId);
	const alternatives = decision.alternatives
		.filter((alternative) => alternative.id !== chosenId)
		.map((alternative): AlternativeOutcome => {
			const contradictedBy: RuleContradiction[] = [];
			let outranked = false;
			for (const rule of decision.rules) {
				if (rule.choose !== alternative.id) continue;
				const result = evaluateRule(rule, profile);
				if (result.state === 'skipped') contradictedBy.push({ rule: rule.id, ...result.contradiction });
				if (result.state === 'fires') outranked = true;
			}
			return {
				alternative,
				contradicted_by: contradictedBy,
				reachable_with_more_information: relevantMissing.some((entry) => entry.would_choose === alternative.id),
				outranked,
			};
		});
	return {
		decision: decision.id,
		decision_revision: decision.revision,
		domain: decision.domain,
		title: decision.title,
		question: decision.question,
		chosen,
		basis: fired ? 'rule' : 'fallback',
		...(fired ? { rule: fired.id } : {}),
		because,
		inputs_used: inputsUsed,
		// Entries that would choose what was chosen anyway cannot change the outcome.
		missing: relevantMissing,
		alternatives,
		changes_when: decision.changes_when,
		evidence: decision.evidence,
	};
}

export function exploreWorkload(
	catalog: ArchitectureDecisionCatalog,
	profile: WorkloadProfile,
): ArchitectureRecommendation {
	return {
		engine_revision: EXPLORE_ENGINE_REVISION,
		catalog_format: catalog.format,
		profile: { ...profile },
		unknown_factors: WORKLOAD_FACTOR_IDS.filter((factor) => profile[factor] === UNKNOWN),
		outcomes: catalog.decisions.map((decision) => evaluateDecision(decision, profile)),
	};
}

/** Read an untrusted object as a profile: unknown keys are refused, absent or invalid factors become refusals too. */
export function parseWorkloadProfile(
	input: unknown,
): { ok: true; profile: WorkloadProfile } | { ok: false; issues: string[] } {
	if (typeof input !== 'object' || input === null || Array.isArray(input)) {
		return { ok: false, issues: ['profile must be an object'] };
	}
	const record = input as Record<string, unknown>;
	const issues: string[] = [];
	for (const key of Object.keys(record)) {
		if (!(WORKLOAD_FACTOR_IDS as string[]).includes(key)) issues.push(`${key}: not a workload factor`);
	}
	const profile = {} as Record<WorkloadFactor, string>;
	for (const factor of WORKLOAD_FACTOR_IDS) {
		const value = record[factor] ?? UNKNOWN;
		if (typeof value !== 'string' || !isFactorValue(factor, value)) {
			issues.push(`${factor}: '${String(value)}' is not a value of this factor`);
			continue;
		}
		profile[factor] = value;
	}
	return issues.length > 0 ? { ok: false, issues } : { ok: true, profile: profile as WorkloadProfile };
}
