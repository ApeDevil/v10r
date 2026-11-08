/**
 * The decision record: one architectural question, its alternatives, the deterministic rules
 * that choose between them, the evidence behind it, and when to revisit it — the ADR/MADR
 * shape made machine-readable. `decisions.json` holds the catalogue; this file declares it and
 * parses it fail-closed.
 *
 * A decision references patterns by registry id and never copies their content: Architecture
 * Engineering says which approach fits, the pattern says how to build it. Whether every id
 * resolves is checked against the registry by `checkDecisionReferences` (called from
 * `pattern-library/validate.ts` and the unit tests).
 *
 * Hand-rolled validation, like `schema.ts`, because the stdio MCP server runs this with no
 * `node_modules`.
 */
import type { Registry } from '../schema.ts';
import {
	ENGINEERING_DOMAINS,
	type EngineeringDomain,
	EVIDENCE_KINDS,
	type EvidenceKind,
	isFactorValue,
	PLACEMENTS,
	type Placement,
	UNKNOWN,
	WORKLOAD_FACTOR_IDS,
	type WorkloadFactor,
} from './vocabulary.ts';

/** The catalogue's shape number. Bumps on a breaking change to this declaration. */
export const ARCHITECTURE_DECISION_FORMAT = 1;

export interface DecisionAlternative {
	id: string;
	approach: string;
	placement?: Placement;
	technologies: string[];
	benefits: string[];
	drawbacks: string[];
	prerequisites: string[];
	contraindications: string[];
	/** When this alternative beats the others — shown whenever it is not the one chosen. */
	prefer_when: string;
	/** Registry pattern ids that implement this alternative. */
	patterns: string[];
}

/**
 * One deterministic rule. `when` is a conjunction over factors; each factor lists the values
 * that satisfy it (a disjunction). A factor the rule does not name is irrelevant to it.
 */
export interface DecisionRule {
	id: string;
	when: Partial<Record<WorkloadFactor, string[]>>;
	choose: string;
	because: string;
}

export interface DecisionEvidence {
	kind: EvidenceKind;
	/** A repo path (optionally `#anchor`), an app route (`/showcases/wasm`) or an `https://` URL. */
	ref: string;
	claim: string;
	/** Required for `measured`: the conditions the numbers hold under. */
	conditions?: string;
	limitations: string;
}

export interface DecisionMigration {
	from: string;
	to: string;
	path: string;
	implications: string;
}

export interface ArchitectureDecision {
	id: string;
	revision: number;
	domain: EngineeringDomain;
	title: string;
	question: string;
	description: string;
	problem: {
		workload: string;
		functional: string[];
		nonfunctional: string[];
		constraints: string[];
		assumptions: string[];
	};
	alternatives: DecisionAlternative[];
	rules: DecisionRule[];
	/** The alternative chosen when no rule fires — by policy the simplest one. */
	fallback: { choose: string; because: string };
	/** Conditions under which the recommendation changes, in words. */
	changes_when: string[];
	evidence: DecisionEvidence[];
	evolution: { revisit_when: string[]; migrations: DecisionMigration[] };
	/** How conformance to the chosen alternative is checked (MADR "confirmation"), when it is. */
	confirmation?: string;
}

export interface ArchitectureDecisionCatalog {
	format: number;
	note?: string;
	decisions: ArchitectureDecision[];
}

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

function isTextList(value: unknown): value is string[] {
	return Array.isArray(value) && value.every(isText);
}

function checkTextFields(value: Record<string, unknown>, fields: readonly string[], where: string, errors: string[]) {
	for (const field of fields) {
		if (!isText(value[field])) errors.push(`${where}.${field}: must be a non-empty string`);
	}
}

function checkListFields(value: Record<string, unknown>, fields: readonly string[], where: string, errors: string[]) {
	for (const field of fields) {
		if (!isTextList(value[field])) errors.push(`${where}.${field}: must be an array of non-empty strings`);
	}
}

function validateAlternative(value: unknown, where: string, errors: string[]): void {
	if (!isRecord(value)) {
		errors.push(`${where}: must be an object`);
		return;
	}
	checkTextFields(value, ['id', 'approach', 'prefer_when'], where, errors);
	checkListFields(
		value,
		['technologies', 'benefits', 'drawbacks', 'prerequisites', 'contraindications', 'patterns'],
		where,
		errors,
	);
	if (typeof value.id === 'string' && !ID.test(value.id)) errors.push(`${where}.id: not kebab-case`);
	if (value.placement !== undefined && !(PLACEMENTS as readonly unknown[]).includes(value.placement)) {
		errors.push(`${where}.placement: '${String(value.placement)}' is not a placement`);
	}
}

function validateRule(value: unknown, where: string, alternativeIds: Set<string>, errors: string[]): void {
	if (!isRecord(value)) {
		errors.push(`${where}: must be an object`);
		return;
	}
	checkTextFields(value, ['id', 'choose', 'because'], where, errors);
	if (typeof value.choose === 'string' && !alternativeIds.has(value.choose)) {
		errors.push(`${where}.choose: '${value.choose}' is not an alternative of this decision`);
	}
	if (!isRecord(value.when) || Object.keys(value.when).length === 0) {
		errors.push(`${where}.when: must name at least one factor`);
		return;
	}
	for (const [factor, values] of Object.entries(value.when)) {
		if (!(WORKLOAD_FACTOR_IDS as string[]).includes(factor)) {
			errors.push(`${where}.when.${factor}: not a workload factor`);
			continue;
		}
		if (!Array.isArray(values) || values.length === 0) {
			errors.push(`${where}.when.${factor}: must list at least one value`);
			continue;
		}
		for (const item of values) {
			// `unknown` is the absence of an answer, never a condition a rule may match on.
			if (item === UNKNOWN || !isFactorValue(factor as WorkloadFactor, item)) {
				errors.push(`${where}.when.${factor}: '${String(item)}' is not a value of this factor`);
			}
		}
	}
}

function validateEvidence(value: unknown, where: string, errors: string[]): void {
	if (!isRecord(value)) {
		errors.push(`${where}: must be an object`);
		return;
	}
	checkTextFields(value, ['ref', 'claim', 'limitations'], where, errors);
	if (!(EVIDENCE_KINDS as readonly unknown[]).includes(value.kind)) {
		errors.push(`${where}.kind: must be one of ${EVIDENCE_KINDS.join('|')}`);
	}
	if (value.kind === 'measured' && !isText(value.conditions)) {
		errors.push(`${where}.conditions: measured evidence must state its conditions`);
	}
	if (value.conditions !== undefined && !isText(value.conditions)) {
		errors.push(`${where}.conditions: must be a non-empty string when present`);
	}
}

function validateDecision(value: unknown, where: string, errors: string[]): void {
	if (!isRecord(value)) {
		errors.push(`${where}: must be an object`);
		return;
	}
	checkTextFields(value, ['id', 'title', 'question', 'description'], where, errors);
	checkListFields(value, ['changes_when'], where, errors);
	if (typeof value.id === 'string' && !ID.test(value.id)) errors.push(`${where}.id: not kebab-case`);
	if (!Number.isInteger(value.revision) || (value.revision as number) < 1) {
		errors.push(`${where}.revision: must be a positive integer`);
	}
	if (!(ENGINEERING_DOMAINS as readonly unknown[]).includes(value.domain)) {
		errors.push(`${where}.domain: must be one of ${ENGINEERING_DOMAINS.join('|')}`);
	}
	if (!isRecord(value.problem)) {
		errors.push(`${where}.problem: must be an object`);
	} else {
		checkTextFields(value.problem, ['workload'], `${where}.problem`, errors);
		checkListFields(
			value.problem,
			['functional', 'nonfunctional', 'constraints', 'assumptions'],
			`${where}.problem`,
			errors,
		);
	}
	const alternativeIds = new Set<string>();
	if (!Array.isArray(value.alternatives) || value.alternatives.length < 2) {
		errors.push(`${where}.alternatives: a decision needs at least two alternatives`);
	} else {
		value.alternatives.forEach((alternative, index) => {
			validateAlternative(alternative, `${where}.alternatives[${index}]`, errors);
			if (isRecord(alternative) && typeof alternative.id === 'string') {
				if (alternativeIds.has(alternative.id)) errors.push(`${where}: duplicate alternative '${alternative.id}'`);
				alternativeIds.add(alternative.id);
			}
		});
	}
	const ruleIds = new Set<string>();
	if (!Array.isArray(value.rules)) {
		errors.push(`${where}.rules: must be an array`);
	} else {
		value.rules.forEach((rule, index) => {
			validateRule(rule, `${where}.rules[${index}]`, alternativeIds, errors);
			if (isRecord(rule) && typeof rule.id === 'string') {
				if (ruleIds.has(rule.id)) errors.push(`${where}: duplicate rule '${rule.id}'`);
				ruleIds.add(rule.id);
			}
		});
	}
	if (!isRecord(value.fallback)) {
		errors.push(`${where}.fallback: must be an object`);
	} else {
		checkTextFields(value.fallback, ['choose', 'because'], `${where}.fallback`, errors);
		if (typeof value.fallback.choose === 'string' && !alternativeIds.has(value.fallback.choose)) {
			errors.push(`${where}.fallback.choose: '${value.fallback.choose}' is not an alternative`);
		}
	}
	if (!Array.isArray(value.evidence) || value.evidence.length === 0) {
		errors.push(`${where}.evidence: a decision needs at least one evidence entry`);
	} else {
		value.evidence.forEach((entry, index) => {
			validateEvidence(entry, `${where}.evidence[${index}]`, errors);
		});
	}
	if (!isRecord(value.evolution)) {
		errors.push(`${where}.evolution: must be an object`);
	} else {
		checkListFields(value.evolution, ['revisit_when'], `${where}.evolution`, errors);
		if (!Array.isArray(value.evolution.migrations)) {
			errors.push(`${where}.evolution.migrations: must be an array`);
		} else {
			value.evolution.migrations.forEach((migration, index) => {
				const at = `${where}.evolution.migrations[${index}]`;
				if (!isRecord(migration)) {
					errors.push(`${at}: must be an object`);
					return;
				}
				checkTextFields(migration, ['from', 'to', 'path', 'implications'], at, errors);
				for (const end of ['from', 'to'] as const) {
					if (typeof migration[end] === 'string' && !alternativeIds.has(migration[end])) {
						errors.push(`${at}.${end}: '${migration[end]}' is not an alternative`);
					}
				}
			});
		}
	}
	if (value.confirmation !== undefined && !isText(value.confirmation)) {
		errors.push(`${where}.confirmation: must be a non-empty string when present`);
	}
}

/** Structurally validate the parsed catalogue. Returns it typed only when there are zero errors. */
export function parseDecisionCatalog(data: unknown): {
	catalog: ArchitectureDecisionCatalog | null;
	errors: string[];
} {
	const errors: string[] = [];
	if (!isRecord(data)) return { catalog: null, errors: ['catalogue root must be an object'] };
	if (data.format !== ARCHITECTURE_DECISION_FORMAT) {
		errors.push(`format: expected ${ARCHITECTURE_DECISION_FORMAT}, got ${String(data.format)}`);
	}
	if (!Array.isArray(data.decisions) || data.decisions.length === 0) {
		errors.push('decisions: must be a non-empty array');
		return { catalog: null, errors };
	}
	const ids = new Set<string>();
	data.decisions.forEach((decision, index) => {
		validateDecision(decision, `decisions[${index}]`, errors);
		if (isRecord(decision) && typeof decision.id === 'string') {
			if (ids.has(decision.id)) errors.push(`duplicate decision id '${decision.id}'`);
			ids.add(decision.id);
		}
	});
	return errors.length > 0
		? { catalog: null, errors }
		: { catalog: data as unknown as ArchitectureDecisionCatalog, errors };
}

/** Every pattern id the catalogue names, with where it is named. */
export function decisionPatternRefs(catalog: ArchitectureDecisionCatalog): { id: string; where: string }[] {
	return catalog.decisions.flatMap((decision) =>
		decision.alternatives.flatMap((alternative) =>
			alternative.patterns.map((id) => ({ id, where: `${decision.id}/${alternative.id}` })),
		),
	);
}

/**
 * Invariant 8: every referenced pattern resolves to a canonical registry record. Returns one
 * message per dangling id; an empty list means every reference resolves.
 */
export function checkDecisionReferences(catalog: ArchitectureDecisionCatalog, registry: Registry): string[] {
	const known = new Set(registry.patterns.map((pattern) => pattern.id));
	return decisionPatternRefs(catalog)
		.filter((ref) => !known.has(ref.id))
		.map((ref) => `${ref.where}: pattern '${ref.id}' is not in the registry`);
}
