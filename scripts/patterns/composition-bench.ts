/**
 * Composition benchmark: does `recommend_emulation_plan` choose the right patterns and name the
 * infrastructure they need? Measured through the real handler, in process, on the real registry.
 *
 *   bun run patterns:bench                                                     # print the report
 *   bun run patterns:bench --write pattern-library/bench/composition-results.json
 *   bun run patterns:bench --compare pattern-library/bench/composition-baseline.json
 *
 * Scenarios live in `pattern-library/bench/composition-scenarios.json` (golden sets are reviewer
 * judgement; `design` scenarios shaped the ontology, `holdout` scenarios were fixed before the
 * changes and check that the improvement generalizes). `mcp:bench` measures retrieval; this
 * measures composition — the decisions an agent acts on.
 *
 * Metrics, per scenario and per set:
 * - precision  = correct / scored steps (steps that are neither `acceptable` nor listed as optional)
 * - recall     = correct / required
 * - unnecessary = scored steps outside required ∪ optional ∪ acceptable
 * - optionalAsRequired = golden-optional constituents the plan made a mandatory step
 * - needRecall = golden required ∪ conditional needs the plan names at the required or conditional level
 * - spuriousNeeds = needs the plan states as REQUIRED that the golden set does not list at any level
 * - factNeedRecall = golden needs covered by the required/conditional needs of the golden STEPS,
 *   read from the registry directly: whether the facts are complete, independent of step selection
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { adoptionNeeds } from '../../pattern-library/infrastructure-needs.ts';
import { loadRegistry } from '../../pattern-library/load.ts';
import { REGISTRY_QUERIES } from '../../pattern-library/query.ts';
import { registryDigest } from '../../pattern-library/registry-digest.ts';
import { buildById, type Registry } from '../../pattern-library/schema.ts';

const ROOT = resolve(import.meta.dir, '../..');
const SCENARIOS = resolve(ROOT, 'pattern-library/bench/composition-scenarios.json');

interface Scenario {
	id: string;
	set: 'design' | 'holdout';
	capabilities: string[];
	required: string[];
	optional: string[];
	acceptable: string[];
	needs: { required: string[]; conditional: string[] };
	note?: string;
}

interface ParsedPlan {
	steps: string[];
	requiredNeeds: string[];
	conditionalNeeds: string[];
	text: string;
}

interface ScenarioResult {
	id: string;
	set: string;
	steps: string[];
	correct: number;
	required: number;
	scored: number;
	unnecessary: string[];
	missing: string[];
	optionalAsRequired: string[];
	optionalListed: string[];
	needsFound: string[];
	needsMissing: string[];
	spuriousNeeds: string[];
	/** Golden needs the golden steps' own declared and inherited needs do not cover (selection-independent). */
	factNeedsMissing: string[];
	/** What the plan itself named, kept so a later scenario correction can rescore this result. */
	named: { required: string[]; conditional: string[] };
	planChars: number;
}

/** Steps print as `### Step N: Title (`id`)` in both the full and the outlined plan. */
function parsePlan(text: string): ParsedPlan {
	const steps = [...text.matchAll(/^### Step \d+: .*\(`([a-z0-9-]+)`\)\s*$/gm)].map((match) => match[1]);
	const list = (label: RegExp) => {
		let line = text.match(label)?.[1] ?? '';
		// Labels carry details in (possibly nested) parentheses; the ids are what remains.
		while (/\([^()]*\)/.test(line)) line = line.replace(/\([^()]*\)/g, '');
		return line
			.split(/\.(?:\s|$)/)[0]
			.split(/,\s*/)
			.map((need) => need.trim())
			.filter((need) => /^[a-z0-9-]+$/.test(need));
	};
	return {
		steps,
		requiredNeeds: list(/^- Required infrastructure: (.+)$/m),
		conditionalNeeds: list(/^- Conditional infrastructure: (.+)$/m),
		text,
	};
}

function factGaps(registry: Registry, scenario: Scenario, goldenNeeds: string[]): string[] {
	const byId = buildById(registry);
	const covered = new Set(
		scenario.required.flatMap((id) => {
			const pattern = byId.get(id);
			return pattern
				? adoptionNeeds(pattern, byId)
						.filter((need) => need.level === 'required' || need.level === 'conditional')
						.map((need) => need.need)
				: [];
		}),
	);
	return goldenNeeds.filter((need) => !covered.has(need));
}

function measure(scenario: Scenario): ScenarioResult {
	const { registry } = loadRegistry();
	if (!registry) throw new Error('registry did not load');
	const outcome = REGISTRY_QUERIES.recommend_emulation_plan(registry, {
		capabilities: scenario.capabilities,
		detail: 'outline',
	});
	const plan = parsePlan(outcome.text);
	const required = new Set(scenario.required);
	const optional = new Set(scenario.optional);
	const acceptable = new Set(scenario.acceptable);
	const scoredSteps = plan.steps.filter((id) => !acceptable.has(id));
	const correct = scoredSteps.filter((id) => required.has(id));
	const goldenNeeds = [...scenario.needs.required, ...scenario.needs.conditional];
	const named = new Set([...plan.requiredNeeds, ...plan.conditionalNeeds]);
	const optionalListed = scenario.optional.filter(
		(id) => !plan.steps.includes(id) && new RegExp(`\`${id}\``).test(outcome.text),
	);
	return {
		id: scenario.id,
		set: scenario.set,
		steps: plan.steps,
		correct: correct.length,
		required: required.size,
		scored: scoredSteps.length,
		unnecessary: scoredSteps.filter((id) => !required.has(id) && !optional.has(id)),
		missing: scenario.required.filter((id) => !plan.steps.includes(id)),
		optionalAsRequired: scoredSteps.filter((id) => optional.has(id)),
		optionalListed,
		needsFound: goldenNeeds.filter((need) => named.has(need)),
		needsMissing: goldenNeeds.filter((need) => !named.has(need)),
		spuriousNeeds: plan.requiredNeeds.filter((need) => !goldenNeeds.includes(need)),
		named: { required: plan.requiredNeeds, conditional: plan.conditionalNeeds },
		factNeedsMissing: factGaps(registry, scenario, goldenNeeds),
		planChars: outcome.text.length,
	};
}

const pct = (part: number, whole: number) => (whole === 0 ? 100 : Math.round((part / whole) * 1000) / 10);

function aggregate(results: ScenarioResult[]) {
	const sum = (pick: (result: ScenarioResult) => number) => results.reduce((total, result) => total + pick(result), 0);
	const correct = sum((result) => result.correct);
	const goldenNeeds = sum((result) => result.needsFound.length + result.needsMissing.length);
	const optionalGolden = sum((result) => result.optionalAsRequired.length + result.optionalListed.length);
	return {
		scenarios: results.length,
		precision: pct(
			correct,
			sum((result) => result.scored),
		),
		recall: pct(
			correct,
			sum((result) => result.required),
		),
		unnecessarySteps: sum((result) => result.unnecessary.length),
		missingSteps: sum((result) => result.missing.length),
		optionalAsRequired: sum((result) => result.optionalAsRequired.length),
		optionalListedAsOptional: `${sum((result) => result.optionalListed.length)}/${optionalGolden}`,
		needRecall: pct(
			sum((result) => result.needsFound.length),
			goldenNeeds,
		),
		spuriousNeeds: sum((result) => result.spuriousNeeds.length),
		factNeedRecall: pct(goldenNeeds - sum((result) => result.factNeedsMissing.length), goldenNeeds),
		planTokensEstimated: Math.ceil(sum((result) => result.planChars) / 4),
	};
}

function commitOf(): string {
	try {
		const sha = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
		const dirty = execSync('git status --porcelain -- pattern-library', { cwd: ROOT }).toString().trim().length > 0;
		return dirty ? `${sha}-dirty` : sha;
	} catch {
		return 'unknown';
	}
}

const { scenarios } = JSON.parse(readFileSync(SCENARIOS, 'utf8')) as { scenarios: Scenario[] };
const { registry } = loadRegistry();
if (!registry) throw new Error('registry did not load');
const results = scenarios.map(measure);
const scenarioChanges = (JSON.parse(readFileSync(SCENARIOS, 'utf8')) as { changes: unknown[] }).changes.length;
const report = {
	/** How many recorded scenario corrections this result was scored with (see the fixture's `changes`). */
	scenarioChanges,
	measuredAt: new Date().toISOString().slice(0, 10),
	commit: commitOf(),
	registryDigest: registryDigest(registry),
	patterns: registry.patterns.length,
	totals: {
		design: aggregate(results.filter((result) => result.set === 'design')),
		holdout: aggregate(results.filter((result) => result.set === 'holdout')),
		all: aggregate(results),
	},
	scenarios: results,
};

const args = process.argv.slice(2);
const writeAt = args.indexOf('--write');
const compareAt = args.indexOf('--compare');
if (writeAt >= 0) {
	writeFileSync(resolve(ROOT, args[writeAt + 1]), `${JSON.stringify(report, null, '\t')}\n`);
}
const rows = (label: string, totals: ReturnType<typeof aggregate>, before?: ReturnType<typeof aggregate>) =>
	Object.entries(totals).map(([metric, value]) => {
		const prior = before ? (before as Record<string, unknown>)[metric] : undefined;
		return `${label.padEnd(8)} ${metric.padEnd(26)} ${String(value).padStart(8)}${prior === undefined ? '' : `   (baseline ${prior})`}`;
	});
const baseline =
	compareAt >= 0 ? (JSON.parse(readFileSync(resolve(ROOT, args[compareAt + 1]), 'utf8')) as typeof report) : undefined;
console.log(
	`composition bench — commit ${report.commit}, registry ${report.registryDigest}, ${report.patterns} records`,
);
for (const set of ['design', 'holdout', 'all'] as const) {
	console.log(rows(set, report.totals[set], baseline?.totals[set]).join('\n'));
}
for (const result of results) {
	const flags = [
		result.missing.length > 0 ? `missing ${result.missing.join(',')}` : '',
		result.unnecessary.length > 0 ? `unnecessary ${result.unnecessary.join(',')}` : '',
		result.optionalAsRequired.length > 0 ? `optional-as-required ${result.optionalAsRequired.join(',')}` : '',
		result.needsMissing.length > 0 ? `needs missing ${result.needsMissing.join(',')}` : '',
		result.spuriousNeeds.length > 0 ? `spurious ${result.spuriousNeeds.join(',')}` : '',
	].filter((flag) => flag.length > 0);
	console.log(`${result.id.padEnd(4)} ${result.correct}/${result.required} ${flags.join(' · ') || 'ok'}`);
}
