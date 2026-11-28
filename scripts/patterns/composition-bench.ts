/**
 * Composition benchmark: does `recommend_emulation_plan` choose the right patterns and state the
 * infrastructure they need at the right level? Measured through the real handler, in process, on
 * the real registry.
 *
 *   bun run patterns:bench                                   # print the report (revised expectations)
 *   bun run patterns:bench --expectations original           # score against the original golden answers
 *   bun run patterns:bench --write <file> [--compare <file>]
 *   bun run patterns:bench --rescore <results.json> --write <file>   # rescore a stored run's plans
 *
 * Scenarios live in `pattern-library/bench/composition-scenarios.json`. `scenarios` holds the
 * current (revised) expectations; every correction since the baseline is a dated entry in
 * `changes` with its `before` value and reason, so the ORIGINAL golden answers are reconstructed
 * exactly (`--expectations original`). Ids follow the current registry; a stored run made before
 * a rename or merge is translated through the reconciliation manifest
 * (`pattern-library/reconciliation/manifest.json`) — an id change is not a golden change.
 *
 * Step metrics, per scenario and per set:
 * - precision = correct / scored steps (steps that are neither `acceptable` nor golden-optional)
 * - recall = correct / required; unnecessary = scored steps outside required ∪ optional ∪ acceptable
 * - optionalAsRequired = golden-optional constituents the plan made a mandatory step
 * - optionalCoverage = golden-optional constituents the plan lists as optional / ALL golden-optional
 *   constituents (omitted ones count against it); optionalOmitted = those the plan never mentions
 *
 * Infrastructure metrics (read from the plan's infrastructure summary, the lines an agent acts on):
 * - needRecall = golden required ∪ conditional needs the plan names at required or conditional
 *   (kept unchanged since the baseline for historical comparison; it ignores the level)
 * - levelAccuracy = golden needs the plan states at exactly their golden level / golden needs
 * - conditionalPromoted = golden-conditional needs the plan states as required
 * - requiredDowngraded = golden-required needs the plan states only below required
 * - pinPreservation = golden technology pins the plan states / golden pins
 * - spuriousNeeds = needs the plan states as REQUIRED that the golden set does not list at any level
 * - factNeedRecall = golden needs covered by the required/conditional adoption needs of the golden
 *   STEPS, read from the registry directly: complete capability coverage of the facts against THIS
 *   benchmark's golden needs, independent of step selection — not proof that every need in the
 *   registry is correct. factLevelAccuracy = the same facts at exactly the golden level.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadRegistry } from '../../pattern-library/load.ts';
import { patternGraph } from '../../pattern-library/pattern-graph.ts';
import { REGISTRY_QUERIES } from '../../pattern-library/query.ts';
import { registryDigest } from '../../pattern-library/registry-digest.ts';
import type { Registry } from '../../pattern-library/schema.ts';

const ROOT = resolve(import.meta.dir, '../..');
const SCENARIOS = resolve(ROOT, 'pattern-library/bench/composition-scenarios.json');
const MANIFEST = resolve(ROOT, 'pattern-library/reconciliation/manifest.json');

type Level = 'required' | 'conditional' | 'optional' | 'implementation';

interface Expectations {
	required: string[];
	optional: string[];
	acceptable: string[];
	needs: { required: string[]; conditional: string[]; pinned?: Record<string, string> };
}

interface Scenario extends Expectations {
	id: string;
	set: 'design' | 'holdout';
	capabilities: string[];
	note?: string;
}

interface ScenarioChange {
	date: string;
	scenario: string;
	/** `golden` corrects an expectation; `added` adds a scenario after the baseline. */
	kind: 'golden' | 'added';
	/** Dotted path into the scenario (`needs.required`, `required`), for `golden` changes. */
	field?: string;
	before?: unknown;
	reason: string;
}

interface Fixture {
	scenarios: Scenario[];
	changes: ScenarioChange[];
}

/** What a plan named: steps, and per need the level and pin it was stated with. */
interface NamedPlan {
	steps: string[];
	needs: Record<string, { level: Level; pinned?: string }>;
	text: string;
	optionalMentioned: string[];
}

/** The reconciliation manifest's id map: old id → current canonical id. */
function idMap(): Map<string, string> {
	if (!existsSync(MANIFEST)) return new Map();
	const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as { entries: { previousId: string; target: string }[] };
	return new Map(manifest.entries.map((entry) => [entry.previousId, entry.target]));
}

/** Split `a, b (x, y), c` at top-level commas. */
function topLevelItems(text: string): string[] {
	const items: string[] = [];
	let depth = 0;
	let current = '';
	for (const char of text) {
		if (char === '(') depth++;
		if (char === ')') depth--;
		if (char === ',' && depth === 0) {
			items.push(current);
			current = '';
		} else current += char;
	}
	if (current.trim().length > 0) items.push(current);
	return items.map((item) => item.trim());
}

function needLine(text: string, label: RegExp, end: RegExp): { need: string; pinned?: string }[] {
	const line = text.match(label)?.[1];
	if (!line) return [];
	return (
		topLevelItems(line.split(end)[0].replace(/\.$/, ''))
			.map((item) => ({ need: item.match(/^[a-z0-9-]+/)?.[0] ?? '', pinned: item.match(/pinned: ([a-z0-9-]+)/)?.[1] }))
			// `none beyond the app runtime` is the empty list, not a need.
			.filter((item) => item.need.length > 0 && item.need !== 'none')
	);
}

/** The plan as printed since Slice 1: needs by level in the infrastructure summary. */
function parsePlan(text: string, golden: Scenario): NamedPlan {
	const steps = [...text.matchAll(/^### Step \d+: .*\(`([a-z0-9-]+)`\)\s*$/gm)].map((match) => match[1]);
	const needs: NamedPlan['needs'] = {};
	const lines: [Level, RegExp, RegExp][] = [
		['implementation', /^- v10r's implementation also uses (.+)$/m, /: not needed/],
		['optional', /^- Optional infrastructure: (.+)$/m, /\.$/],
		['conditional', /^- Conditional infrastructure: (.+)$/m, /\. Settle/],
		['required', /^- Required infrastructure: (.+)$/m, /\.$/],
	];
	// Weakest first, so a need stated at several levels ends at its strictest.
	for (const [level, label, end] of lines) {
		for (const item of needLine(text, label, end)) needs[item.need] = { level, pinned: item.pinned };
	}
	return { steps, needs, text, optionalMentioned: mentioned(text, golden.optional) };
}

/** The pre-Slice-1 plan: one "This plan requires: postgres, redis." line of technologies, no levels. */
const LEGACY_NEED: Record<string, string> = {
	postgres: 'relational-db',
	pgvector: 'vector-search',
	neo4j: 'graph-db',
	redis: 'key-value-store',
	'object-storage': 'object-storage',
	cron: 'scheduler',
	'ai-provider': 'llm-provider',
	'third-party-api': 'external-api',
	'web-worker': 'web-worker',
	'wasm-toolchain': 'wasm-toolchain',
	'service-worker': 'service-worker',
	'container-host': 'container-host',
};

function parseLegacyPlan(text: string, golden: Scenario): NamedPlan {
	const steps = [...text.matchAll(/^### Step \d+: .*\(`([a-z0-9-]+)`\)\s*$/gm)].map((match) => match[1]);
	const line = text.match(/This plan requires: ([a-z0-9, -]+?)(?:\.| —)/)?.[1] ?? '';
	const needs: NamedPlan['needs'] = {};
	for (const word of line.split(/,\s*/).filter((item) => item.length > 0)) {
		const need = LEGACY_NEED[word] ?? word;
		// The legacy line named technologies: naming the pinned one states the pin.
		needs[need] = { level: 'required', pinned: need === word ? needs[need]?.pinned : word };
	}
	return { steps, needs, text, optionalMentioned: mentioned(text, golden.optional) };
}

function mentioned(text: string, ids: string[]): string[] {
	return ids.filter((id) => new RegExp(`\`${id}\``).test(text));
}

/** The original golden answers: revised expectations with every recorded correction reverted. */
function expectationsFor(fixture: Fixture, which: 'original' | 'revised'): Scenario[] {
	if (which === 'revised') return fixture.scenarios;
	const added = new Set(fixture.changes.filter((change) => change.kind === 'added').map((change) => change.scenario));
	return fixture.scenarios
		.filter((scenario) => !added.has(scenario.id))
		.map((scenario) => {
			const original = structuredClone(scenario) as unknown as Record<string, unknown>;
			const own = fixture.changes.filter((change) => change.scenario === scenario.id && change.kind === 'golden');
			for (const change of own.reverse()) {
				const path = (change.field ?? '').split('.');
				let node = original;
				for (const key of path.slice(0, -1)) node = node[key] as Record<string, unknown>;
				node[path[path.length - 1]] = structuredClone(change.before);
			}
			return original as unknown as Scenario;
		});
}

const LEVEL_ORDER: Level[] = ['required', 'conditional', 'optional', 'implementation'];

function score(
	golden: Scenario,
	plan: NamedPlan,
	registry: Registry,
	translate: Map<string, string>,
	/** A stored run's own facts (its registry predates `needs`); replaces the registry read. */
	storedFacts?: Record<string, Level>,
) {
	const steps = [...new Set(plan.steps.map((id) => translate.get(id) ?? id))];
	const required = new Set(golden.required);
	const optional = new Set(golden.optional);
	// A merge can map an acceptable id onto a required one; required wins.
	const acceptable = new Set(golden.acceptable.filter((id) => !required.has(id) && !optional.has(id)));
	const scoredSteps = steps.filter((id) => !acceptable.has(id));
	const correct = scoredSteps.filter((id) => required.has(id));
	const goldenLevel = new Map<string, Level>([
		...golden.needs.required.map((need) => [need, 'required'] as [string, Level]),
		...golden.needs.conditional.map((need) => [need, 'conditional'] as [string, Level]),
	]);
	const stated = (need: string) => plan.needs[need];
	const atRequiredOrConditional = (need: string) =>
		stated(need)?.level === 'required' || stated(need)?.level === 'conditional';
	const pins = Object.entries(golden.needs.pinned ?? {});
	const optionalMentioned = golden.optional.filter(
		(id) =>
			plan.optionalMentioned.includes(id) ||
			[...translate].some(([old, now]) => now === id && plan.text.includes(`\`${old}\``)),
	);
	const optionalListed = optionalMentioned.filter((id) => !steps.includes(id));
	const graph = storedFacts ? null : patternGraph(registry);
	const factNeeds = new Map<string, Level>();
	for (const [need, level] of Object.entries(storedFacts ?? {})) factNeeds.set(need, level);
	for (const id of storedFacts ? [] : golden.required) {
		if (!graph?.byId.has(id)) continue;
		for (const need of graph.needs(id)) {
			if (need.level !== 'required' && need.level !== 'conditional') continue;
			const known = factNeeds.get(need.need);
			if (!known || LEVEL_ORDER.indexOf(need.level) < LEVEL_ORDER.indexOf(known)) factNeeds.set(need.need, need.level);
		}
	}
	return {
		id: golden.id,
		steps,
		correct: correct.length,
		required: required.size,
		scored: scoredSteps.length,
		unnecessary: scoredSteps.filter((id) => !required.has(id) && !optional.has(id)),
		missing: golden.required.filter((id) => !steps.includes(id)),
		optionalGolden: golden.optional.length,
		optionalAsRequired: scoredSteps.filter((id) => optional.has(id)),
		optionalListed,
		optionalOmitted: golden.optional.filter((id) => !optionalMentioned.includes(id)),
		goldenNeeds: goldenLevel.size,
		needsFound: [...goldenLevel.keys()].filter(atRequiredOrConditional),
		needsMissing: [...goldenLevel.keys()].filter((need) => !atRequiredOrConditional(need)),
		levelCorrect: [...goldenLevel].filter(([need, level]) => stated(need)?.level === level).map(([need]) => need),
		conditionalPromoted: golden.needs.conditional.filter((need) => stated(need)?.level === 'required'),
		requiredDowngraded: golden.needs.required.filter((need) => stated(need) && stated(need)?.level !== 'required'),
		pinsGolden: pins.length,
		pinsPreserved: pins
			.filter(([need, tech]) => stated(need)?.pinned === tech)
			.map(([need, tech]) => `${need}=${tech}`),
		spuriousNeeds: Object.entries(plan.needs)
			.filter(([need, entry]) => entry.level === 'required' && !goldenLevel.has(need))
			.map(([need]) => need),
		factNeedsMissing: [...goldenLevel.keys()].filter((need) => !factNeeds.has(need)),
		factLevelCorrect: [...goldenLevel].filter(([need, level]) => factNeeds.get(need) === level).length,
		named: plan.needs,
		planChars: plan.text.length,
	};
}

type ScenarioResult = ReturnType<typeof score> & { set: string };

const pct = (part: number, whole: number) => (whole === 0 ? 'n/a' : Math.round((part / whole) * 1000) / 10);

function aggregate(results: ScenarioResult[]) {
	const sum = (pick: (result: ScenarioResult) => number) => results.reduce((total, result) => total + pick(result), 0);
	const correct = sum((result) => result.correct);
	const goldenNeeds = sum((result) => result.goldenNeeds);
	const optionalGolden = sum((result) => result.optionalGolden);
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
		optionalCoverage: pct(
			sum((result) => result.optionalListed.length),
			optionalGolden,
		),
		optionalOmitted: sum((result) => result.optionalOmitted.length),
		needRecall: pct(
			sum((result) => result.needsFound.length),
			goldenNeeds,
		),
		levelAccuracy: pct(
			sum((result) => result.levelCorrect.length),
			goldenNeeds,
		),
		conditionalPromoted: sum((result) => result.conditionalPromoted.length),
		requiredDowngraded: sum((result) => result.requiredDowngraded.length),
		pinPreservation: pct(
			sum((result) => result.pinsPreserved.length),
			sum((result) => result.pinsGolden),
		),
		spuriousNeeds: sum((result) => result.spuriousNeeds.length),
		factNeedRecall: pct(goldenNeeds - sum((result) => result.factNeedsMissing.length), goldenNeeds),
		factLevelAccuracy: pct(
			sum((result) => result.factLevelCorrect),
			goldenNeeds,
		),
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

const args = process.argv.slice(2);
const arg = (flag: string) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const which = arg('--expectations') === 'original' ? 'original' : 'revised';
const fixture = JSON.parse(readFileSync(SCENARIOS, 'utf8')) as Fixture;
const goldens = expectationsFor(fixture, which);
const { registry } = loadRegistry();
if (!registry) throw new Error('registry did not load');
const translate = idMap();

/** Stored plans of an earlier run (its `plans`), rescored against today's expectations. */
const rescoreFrom = arg('--rescore');
const stored = rescoreFrom
	? (JSON.parse(readFileSync(resolve(ROOT, rescoreFrom), 'utf8')) as {
			commit: string;
			registryDigest: string;
			plans: Record<string, { text: string; format: 'legacy' | 'levels'; facts?: Record<string, Level> }>;
		})
	: undefined;
const legacy = args.includes('--legacy-plans');

const plans: Record<string, { text: string; format: 'legacy' | 'levels'; facts?: Record<string, Level> }> = {};
const results: ScenarioResult[] = goldens.map((golden) => {
	let text: string;
	let format: 'legacy' | 'levels';
	if (stored) {
		const plan = stored.plans[golden.id];
		if (!plan) throw new Error(`stored run has no plan for ${golden.id}: re-measure it at its commit instead`);
		({ text, format } = plan);
		plans[golden.id] = plan;
	} else {
		text = REGISTRY_QUERIES.recommend_emulation_plan(registry, {
			capabilities: golden.capabilities,
			detail: 'outline',
		}).text;
		format = legacy ? 'legacy' : 'levels';
	}
	plans[golden.id] ??= { text, format };
	const plan = format === 'legacy' ? parseLegacyPlan(text, golden) : parsePlan(text, golden);
	return { ...score(golden, plan, registry, translate, stored?.plans[golden.id]?.facts), set: golden.set };
});

const report = {
	expectations: which,
	/** Recorded scenario corrections and additions this result was scored with. */
	scenarioChanges: which === 'revised' ? fixture.changes.length : 0,
	measuredAt: new Date().toISOString().slice(0, 10),
	commit: stored ? stored.commit : commitOf(),
	registryDigest: stored ? stored.registryDigest : registryDigest(registry),
	rescoredFrom: rescoreFrom,
	totals: {
		design: aggregate(results.filter((result) => result.set === 'design')),
		holdout: aggregate(results.filter((result) => result.set === 'holdout')),
		all: aggregate(results),
	},
	scenarios: results,
	plans,
};

const writeTo = arg('--write');
if (writeTo) writeFileSync(resolve(ROOT, writeTo), `${JSON.stringify(report, null, '\t')}\n`);
const compareWith = arg('--compare');
const baseline = compareWith
	? (JSON.parse(readFileSync(resolve(ROOT, compareWith), 'utf8')) as typeof report)
	: undefined;
const rows = (label: string, totals: ReturnType<typeof aggregate>, before?: ReturnType<typeof aggregate>) =>
	Object.entries(totals).map(([metric, value]) => {
		const prior = before ? (before as Record<string, unknown>)[metric] : undefined;
		return `${label.padEnd(8)} ${metric.padEnd(22)} ${String(value).padStart(8)}${prior === undefined ? '' : `   (was ${prior})`}`;
	});
console.log(
	`composition bench — ${which} expectations, commit ${report.commit}, registry ${report.registryDigest}, ${goldens.length} scenarios`,
);
for (const set of ['design', 'holdout', 'all'] as const) {
	console.log(rows(set, report.totals[set], baseline?.totals[set]).join('\n'));
}
for (const result of results) {
	const flags = [
		result.missing.length > 0 ? `missing ${result.missing.join(',')}` : '',
		result.unnecessary.length > 0 ? `unnecessary ${result.unnecessary.join(',')}` : '',
		result.optionalAsRequired.length > 0 ? `optional-as-required ${result.optionalAsRequired.join(',')}` : '',
		result.optionalOmitted.length > 0 ? `optional-omitted ${result.optionalOmitted.join(',')}` : '',
		result.needsMissing.length > 0 ? `needs missing ${result.needsMissing.join(',')}` : '',
		result.conditionalPromoted.length > 0 ? `promoted ${result.conditionalPromoted.join(',')}` : '',
		result.requiredDowngraded.length > 0 ? `downgraded ${result.requiredDowngraded.join(',')}` : '',
		result.spuriousNeeds.length > 0 ? `spurious ${result.spuriousNeeds.join(',')}` : '',
	].filter((flag) => flag.length > 0);
	console.log(`${result.id.padEnd(4)} ${result.correct}/${result.required} ${flags.join(' · ') || 'ok'}`);
}
