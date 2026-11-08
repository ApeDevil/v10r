/**
 * The Architecture Engineering tools of the Pattern MCP: `explore_architecture` and
 * `check_architecture`. Same contract as the registry tools in `query.ts` (which lists them in
 * `QUERY_TOOLS` and `REGISTRY_QUERIES`, so both transports serve them with no per-transport
 * code), and the same engine as the Studio (`architecture-engineering/`), so an agent and a
 * person get the identical, deterministic answer for the same input.
 *
 * Arguments are untrusted. The workload profile is read against the closed factor vocabulary;
 * the model goes through the Studio's fail-closed parser (strict keys, bounded sizes, integrity
 * checks). Nothing in either is executed. A refused profile is described in the vocabulary's
 * own literals; a refused model lists at most ten issues, each path and message length-bounded
 * and an unknown key reported at its parent, so caller text is never reflected at length.
 *
 * Framework-free and filesystem-free, like `query.ts`: the stdio server runs it under bare Bun.
 */

import {
	ARCHITECTURE_MODEL_FORMAT,
	type ArchitectureFinding,
	checkArchitecture,
	countBySeverity,
	DECISION_CATALOG,
	type DecisionOutcome,
	ENGINEERING_DOMAIN_TITLES,
	EVIDENCE_KIND_LABELS,
	exploreWorkload,
	FINDING_SEVERITIES,
	findWorkloadExample,
	isFactorValue,
	MODEL_LIMITS,
	modelFromRecommendation,
	parseArchitectureModel,
	stringifyArchitectureFile,
	UNKNOWN,
	WORKLOAD_EXAMPLES,
	WORKLOAD_FACTOR_IDS,
	WORKLOAD_FACTOR_LABELS,
	WORKLOAD_FACTORS,
	type WorkloadFactor,
	type WorkloadProfile,
} from './architecture-engineering/index.ts';
import type { NextAction, QueryOutcome, ToolDef } from './query.ts';
import type { Registry } from './schema.ts';

/** Issues listed per refusal; the rest are counted. Keeps a hostile model from inflating the reply. */
const MAX_LISTED_ISSUES = 10;
const MAX_ISSUE_PATH = 80;
const MAX_ISSUE_MESSAGE = 160;

const EXAMPLE_IDS = WORKLOAD_EXAMPLES.map((example) => example.id);

const PROFILE_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	description:
		'Workload factors. Omit a factor (or pass "unknown") when it is not known — it is reported, never guessed.',
	properties: Object.fromEntries(
		WORKLOAD_FACTOR_IDS.map((factor) => [
			factor,
			{ type: 'string', enum: [UNKNOWN, ...WORKLOAD_FACTORS[factor]], description: WORKLOAD_FACTOR_LABELS[factor] },
		]),
	),
};

export const ARCHITECTURE_TOOLS: ToolDef[] = [
	{
		name: 'explore_architecture',
		description:
			'Recommend an architecture for a workload — deterministic decision records, no inference: for each decision (where compute runs, runtime, interaction style, data store, processing locality, deployment shape, acceleration) the chosen approach, the rule that chose it, the alternatives and why they lost, missing information, evidence kinds and the patterns to emulate. Unknown factors stay unknown.',
		inputSchema: {
			type: 'object',
			additionalProperties: false,
			properties: {
				profile: PROFILE_SCHEMA,
				example: {
					type: 'string',
					enum: EXAMPLE_IDS,
					description: 'Start from one of the example workloads; factors in profile override it.',
				},
				include_model: {
					type: 'boolean',
					default: false,
					description:
						'Also return a starting architecture model (JSON) built from the recommendation, ready for check_architecture.',
				},
			},
		},
	},
	{
		name: 'check_architecture',
		description:
			'Statically check an architecture model — deterministic rules, nothing executed or measured: secrets exposed to clients, unauthenticated trust boundaries, CPU work on the main thread, long-running work in requests, incompatible protocols, missing failure handling, shared data ownership, unjustified services. Each finding has a severity (error, warning, unknown, recommendation), the constraint, a fix and patterns. Security findings are reported apart.',
		inputSchema: {
			type: 'object',
			additionalProperties: false,
			properties: {
				model: {
					type: 'object',
					description: `An architecture model (format ${ARCHITECTURE_MODEL_FORMAT}), or an exported file { model, layout }. explore_architecture with include_model returns a valid one to start from.`,
				},
			},
			required: ['model'],
		},
	},
];

const ok = (text: string): QueryOutcome => ({ ok: true, text });

const EXPLORE_RECOVERY: NextAction = {
	tool: 'explore_architecture',
	args: { example: 'lightweight-rest-api', include_model: true },
	why: 'returns a valid profile result and a starting model to adapt.',
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function bulletList(items: readonly string[]): string {
	return items.map((item) => `- ${item}`).join('\n');
}

/** Read the profile without echoing caller text: unknown keys are counted, bad values named by factor. */
function readProfile(
	base: WorkloadProfile,
	input: unknown,
): { ok: true; profile: WorkloadProfile } | { ok: false; issues: string[] } {
	if (input === undefined) return { ok: true, profile: base };
	if (!isRecord(input)) return { ok: false, issues: ['profile must be an object of workload factors'] };
	const issues: string[] = [];
	const unknownKeys = Object.keys(input).filter((key) => !(WORKLOAD_FACTOR_IDS as string[]).includes(key)).length;
	if (unknownKeys > 0)
		issues.push(`${unknownKeys} key(s) are not workload factors (factors: ${WORKLOAD_FACTOR_IDS.join(', ')})`);
	const profile = { ...base } as Record<WorkloadFactor, string>;
	for (const factor of WORKLOAD_FACTOR_IDS) {
		const value = input[factor];
		if (value === undefined) continue;
		if (typeof value !== 'string' || !isFactorValue(factor, value)) {
			issues.push(`${factor} must be one of: ${[UNKNOWN, ...WORKLOAD_FACTORS[factor]].join(', ')}`);
			continue;
		}
		profile[factor] = value;
	}
	return issues.length > 0 ? { ok: false, issues } : { ok: true, profile: profile as WorkloadProfile };
}

function renderOutcome(outcome: DecisionOutcome): string {
	const basis = outcome.basis === 'rule' && outcome.rule ? `rule \`${outcome.rule}\`` : 'default — no rule matched';
	const inputs = Object.entries(outcome.inputs_used).map(([factor, value]) => `${factor}=${value}`);
	const lines = [
		`## ${outcome.title} (${ENGINEERING_DOMAIN_TITLES[outcome.domain]}) — \`${outcome.decision}\` r${outcome.decision_revision}`,
		`**Chosen:** ${outcome.chosen.approach} (\`${outcome.chosen.id}\`, ${basis})`,
		`**Because:** ${outcome.because}`,
		inputs.length > 0 ? `**Inputs used:** ${inputs.join(', ')}` : '',
		outcome.missing.length > 0
			? `**Missing information:**\n${bulletList(outcome.missing.map((entry) => `if ${entry.factors.join(' + ')} were known → could become \`${entry.would_choose}\``))}`
			: '',
		`**Alternatives:**\n${bulletList(
			outcome.alternatives.map((entry) => {
				const reasons = [
					...entry.contradicted_by.map((c) => `ruled out: ${c.factor}=${c.actual}, needs ${c.needs.join('/')}`),
					entry.reachable_with_more_information ? 'reachable with more information' : '',
					entry.outranked ? 'possible, but an earlier rule chose another option' : '',
				].filter((reason) => reason.length > 0);
				return `\`${entry.alternative.id}\` ${entry.alternative.approach}${reasons.length > 0 ? ` — ${reasons.join('; ')}` : ''}`;
			}),
		)}`,
		`**Trade-offs:** + ${outcome.chosen.benefits.join('; ')} / − ${outcome.chosen.drawbacks.join('; ')}`,
		`**Revisit when:** ${outcome.changes_when.join('; ')}`,
		`**Evidence:** ${outcome.evidence.map((entry) => `[${EVIDENCE_KIND_LABELS[entry.kind]}] ${entry.claim}`).join(' · ')}`,
		outcome.chosen.patterns.length > 0 ? `**Patterns:** ${outcome.chosen.patterns.join(', ')}` : '',
	];
	return lines.filter((line) => line.length > 0).join('\n');
}

export function exploreArchitecture(_registry: Registry, args: Record<string, unknown>): QueryOutcome {
	let base: WorkloadProfile | undefined;
	if (args.example !== undefined) {
		const example = typeof args.example === 'string' ? findWorkloadExample(args.example) : undefined;
		if (!example) {
			return {
				ok: false,
				text: `example must be one of: ${EXAMPLE_IDS.join(', ')}.`,
				diag: 'invalid_args',
				next: [EXPLORE_RECOVERY],
			};
		}
		base = example.profile;
	}
	const read = readProfile(
		base ?? (Object.fromEntries(WORKLOAD_FACTOR_IDS.map((factor) => [factor, UNKNOWN])) as WorkloadProfile),
		args.profile,
	);
	if (!read.ok) {
		return {
			ok: false,
			text: `Invalid profile:\n${bulletList(read.issues)}`,
			diag: 'invalid_args',
			next: [EXPLORE_RECOVERY],
		};
	}
	const recommendation = exploreWorkload(DECISION_CATALOG, read.profile);
	const known = WORKLOAD_FACTOR_IDS.length - recommendation.unknown_factors.length;
	const sections = [
		`# Architecture recommendation (${recommendation.outcomes.length} decisions, engine revision ${recommendation.engine_revision})`,
		`Based on ${known} of ${WORKLOAD_FACTOR_IDS.length} factors.${recommendation.unknown_factors.length > 0 ? ` Unknown: ${recommendation.unknown_factors.join(', ')}.` : ''}`,
		...recommendation.outcomes.map(renderOutcome),
	];
	if (args.include_model === true) {
		const model = modelFromRecommendation(recommendation);
		sections.push(`## Starting model\n\n\`\`\`json\n${stringifyArchitectureFile({ model })}\n\`\`\``);
	}
	sections.push(
		`---\n${bulletList([
			'Deterministic: the same profile and engine revision always give this result. No scoring formula, no inference.',
			'Preliminary: a recommendation names its rule and evidence kind; an estimate is not a measurement.',
			'Next: check_architecture on a model, get_pattern for the patterns named above.',
		])}`,
	);
	return ok(sections.join('\n\n'));
}

function renderFinding(entry: ArchitectureFinding): string {
	return [
		`- **[${entry.severity}] \`${entry.code}\`** at \`${entry.subject}\` — ${entry.detected}`,
		`  Why: ${entry.why}`,
		`  Constraint: ${entry.constraint}`,
		`  Fix: ${entry.fix}`,
		entry.patterns.length > 0 ? `  Patterns: ${entry.patterns.join(', ')}` : '',
	]
		.filter((line) => line.length > 0)
		.join('\n');
}

/** An unknown key is reported at its parent, so the caller's key text is never reflected. */
function describeIssue(issue: { path: string; message: string }): string {
	const path =
		issue.message === 'unknown key'
			? issue.path.split('.').slice(0, -1).join('.')
			: issue.path.slice(0, MAX_ISSUE_PATH);
	return `${path || '(root)'}: ${issue.message.slice(0, MAX_ISSUE_MESSAGE)}`;
}

export function checkArchitectureTool(_registry: Registry, args: Record<string, unknown>): QueryOutcome {
	let input = args.model;
	// An exported file wraps the model; the layout is presentation and plays no part in a check.
	if (isRecord(input) && isRecord(input.model) && input.nodes === undefined) input = input.model;
	if (!isRecord(input)) {
		return {
			ok: false,
			text: 'model must be an architecture model object.',
			diag: 'invalid_args',
			next: [EXPLORE_RECOVERY],
		};
	}
	if (JSON.stringify(input).length > MODEL_LIMITS.fileBytes) {
		return {
			ok: false,
			text: `model is larger than ${MODEL_LIMITS.fileBytes} characters.`,
			diag: 'invalid_args',
			next: [EXPLORE_RECOVERY],
		};
	}
	const parsed = parseArchitectureModel(input);
	if (!parsed.ok) {
		const listed = parsed.issues.slice(0, MAX_LISTED_ISSUES).map(describeIssue);
		const more = parsed.issues.length - listed.length;
		return {
			ok: false,
			text: `The model was refused — nothing was checked:\n${bulletList(listed)}${more > 0 ? `\n- …and ${more} more` : ''}`,
			diag: 'invalid_args',
			next: [EXPLORE_RECOVERY],
		};
	}
	const model = parsed.model;
	const findings = checkArchitecture(model);
	const counts = countBySeverity(findings);
	const security = findings.filter((entry) => entry.category === 'security');
	const design = findings.filter((entry) => entry.category !== 'security');
	const header = `# Architecture check: \`${model.id}\` (${model.nodes.length} components, ${model.connections.length} connections)`;
	const summary = FINDING_SEVERITIES.map((severity) => `${severity} ${counts[severity]}`).join(' · ');
	const body =
		findings.length === 0
			? 'No findings. The checks cover structure and stated facts only; they do not measure performance.'
			: [
					`## Security (${security.length})\n${security.length > 0 ? security.map(renderFinding).join('\n') : 'None.'}`,
					`## Design (${design.length})\n${design.length > 0 ? design.map(renderFinding).join('\n') : 'None.'}`,
				].join('\n\n');
	return ok(
		`${header}\n\n${summary}\n\n${body}\n\n---\n- Deterministic static checks; nothing in the model is executed and nothing is measured.`,
	);
}

/** The Architecture Engineering tools by name, merged into `REGISTRY_QUERIES`. */
export const ARCHITECTURE_QUERIES: Record<string, (registry: Registry, args: Record<string, unknown>) => QueryOutcome> =
	{
		explore_architecture: exploreArchitecture,
		check_architecture: checkArchitectureTool,
	};
