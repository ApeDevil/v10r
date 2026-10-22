/**
 * Retrieval benchmark for the Pattern MCP: relevance, response size, latency, and the token
 * cost of whole agent workflows — measured against the real tool handlers, not a model of them.
 *
 *   bun run mcp:bench                              # print the report
 *   bun run mcp:bench --write pattern-library/bench/baseline.json
 *   bun run mcp:bench --compare pattern-library/bench/baseline.json
 *
 * It drives the STDIO handlers (`mcp/tools.ts`), which run under bare Bun; the hosted
 * handlers render the same text from the same shared modules, pinned by
 * `src/lib/server/mcp/patterns/parity.test.ts`.
 *
 * What the numbers are and are not:
 * - Relevance is over labelled query sets in `pattern-library/bench/`: `dev` (author-labelled
 *   before any ranking change, and tuned against), `holdout` (labelled blind to the engine before
 *   the ranking work) and `holdout2` (labelled blind after it, never tuned against). Synthetic,
 *   not production telemetry.
 * - Tokens are ESTIMATED as ceil(chars / 4). No Claude tokenizer runs offline; the ratio between
 *   two runs is meaningful, the absolute count is approximate.
 * - Latency is wall-clock on this machine, in-process (no transport, no network). Compare runs
 *   from one machine only.
 * - Workflows are scripted agent tasks: an oracle that already knows the right pattern, so they
 *   measure what the INTERFACE costs, never how well a model would choose.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { handleToolCall, TOOLS, type ToolContext } from '../../mcp/tools.ts';
import { loadRegistry } from '../../pattern-library/load.ts';
import { scorePatterns } from '../../pattern-library/search.ts';

const ROOT = resolve(import.meta.dir, '../..');
const BENCH_DIR = resolve(ROOT, 'pattern-library/bench');

interface BenchQuery {
	id: string;
	kind?: string;
	query: string;
	relevant: string[];
	acceptable: string[];
}

interface BenchPlan {
	id: string;
	capabilities: string[];
	required: string[];
}

interface WorkflowStep {
	tool: string;
	args: Record<string, unknown>;
}

/** One scripted task, with the calls each interface generation needs to complete it. */
interface Workflow {
	id: string;
	task: string;
	variants: Record<string, WorkflowStep[]>;
}

const loaded = loadRegistry();
if (!loaded.registry) throw new Error(`registry failed to load: ${loaded.error}`);
const registry = loaded.registry;
const ctx: ToolContext = { registry, loadError: null, root: ROOT };

const estimateTokens = (text: string) => Math.ceil(text.length / 4);

function call(tool: string, args: Record<string, unknown>): { text: string; isError: boolean } {
	const result = handleToolCall(tool, args, ctx);
	return { text: result.content.map((block) => block.text).join('\n'), isError: result.isError === true };
}

function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0;
	return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function stats(values: number[]) {
	const sorted = [...values].sort((a, b) => a - b);
	const sum = sorted.reduce((total, value) => total + value, 0);
	return {
		mean: Math.round(sum / Math.max(1, sorted.length)),
		p50: percentile(sorted, 50),
		p95: percentile(sorted, 95),
		max: sorted.at(-1) ?? 0,
	};
}

function relevance(queries: BenchQuery[]) {
	let hit1 = 0;
	let recall3 = 0;
	let reciprocal = 0;
	let answerable = 0;
	let abstained = 0;
	let missing = 0;
	let falseAbstained = 0;
	const misses: string[] = [];
	for (const q of queries) {
		const hits = scorePatterns(q.query, registry.patterns);
		const ranked = hits.map((hit) => hit.pattern.id);
		// "Abstained" = nothing returned, or the best hit graded weak — the result header then
		// tells the agent the registry may not cover this. (The baseline engine had no grade.)
		const weakTop = hits.length === 0 || (hits[0] as { strength?: string }).strength === 'weak';
		if (q.relevant.length === 0) {
			missing += 1;
			if (weakTop) abstained += 1;
			else misses.push(`${q.id} "${q.query}" (missing) → returned ${ranked.length}, top ${ranked[0]}`);
			continue;
		}
		answerable += 1;
		if (weakTop) falseAbstained += 1;
		const good = new Set([...q.relevant, ...q.acceptable]);
		if (good.has(ranked[0])) hit1 += 1;
		else misses.push(`${q.id} "${q.query}" → top ${ranked[0] ?? '(none)'}, want ${q.relevant.join('|')}`);
		const top3 = new Set(ranked.slice(0, 3));
		recall3 += q.relevant.filter((id) => top3.has(id)).length / Math.min(3, q.relevant.length);
		const rank = ranked.slice(0, 10).findIndex((id) => good.has(id));
		reciprocal += rank === -1 ? 0 : 1 / (rank + 1);
	}
	const pct = (value: number, of: number) => Math.round((1000 * value) / Math.max(1, of)) / 10;
	return {
		queries: queries.length,
		accuracyAt1: pct(hit1, answerable),
		recallAt3: pct(recall3, answerable),
		mrrAt10: Math.round((1000 * reciprocal) / Math.max(1, answerable)) / 1000,
		missingAbstained: `${abstained}/${missing}`,
		answerableGradedWeak: `${falseAbstained}/${answerable}`,
		misses,
	};
}

function planQuality(plans: BenchPlan[]) {
	return plans.map((plan) => {
		const { text } = call('recommend_emulation_plan', { capabilities: plan.capabilities });
		const steps = [...text.matchAll(/^### Step \d+: .*\(`([a-z0-9-]+)`\)/gm)].map((match) => match[1]);
		const required = new Set(plan.required);
		return {
			id: plan.id,
			steps: steps.length,
			requiredCovered: `${plan.required.filter((id) => steps.includes(id)).length}/${plan.required.length}`,
			extra: steps.filter((id) => !required.has(id)),
			tokens: estimateTokens(text),
		};
	});
}

function responseSizes(queries: BenchQuery[], plans: BenchPlan[]) {
	const search = queries.map((q) => estimateTokens(call('search_patterns', { query: q.query }).text));
	const trace = queries.map((q) => estimateTokens(call('trace_capability', { capability: q.query }).text));
	const card = registry.patterns.map((p) => estimateTokens(call('get_pattern', { id: p.id }).text));
	const deepCard = registry.patterns
		.filter((p) => p.tier === 'deep')
		.map((p) => estimateTokens(call('get_pattern', { id: p.id }).text));
	const plan = plans.map((p) =>
		estimateTokens(call('recommend_emulation_plan', { capabilities: p.capabilities }).text),
	);
	return {
		toolsList: estimateTokens(JSON.stringify({ tools: TOOLS })),
		search_patterns: stats(search),
		trace_capability: stats(trace),
		get_pattern_all: stats(card),
		get_pattern_deep: stats(deepCard),
		recommend_emulation_plan: stats(plan),
	};
}

function latency(queries: BenchQuery[], plans: BenchPlan[], rounds = 30) {
	const time = (fn: () => void) => {
		const samples: number[] = [];
		for (let round = 0; round < rounds; round += 1) {
			const started = performance.now();
			fn();
			samples.push((performance.now() - started) * 1000);
		}
		return samples;
	};
	const searchUs = queries.flatMap((q) => time(() => call('search_patterns', { query: q.query })));
	const planUs = plans.flatMap((p) => time(() => call('recommend_emulation_plan', { capabilities: p.capabilities })));
	const cardUs = registry.patterns.flatMap((p) => time(() => call('get_pattern', { id: p.id })));
	const round = (s: ReturnType<typeof stats>) => ({ p50us: Math.round(s.p50), p95us: Math.round(s.p95) });
	return {
		search_patterns: round(stats(searchUs)),
		get_pattern: round(stats(cardUs)),
		recommend_emulation_plan: round(stats(planUs)),
	};
}

/** Per call, a round trip also costs the model the call itself: args plus a fixed envelope estimate. */
const CALL_OVERHEAD_TOKENS = 30;

function runWorkflows(workflows: Workflow[], variant: string) {
	return workflows
		.filter((workflow) => workflow.variants[variant])
		.map((workflow) => {
			let tokens = 0;
			let errors = 0;
			const steps = workflow.variants[variant];
			for (const step of steps) {
				const { text, isError } = call(step.tool, step.args);
				tokens += estimateTokens(text) + estimateTokens(JSON.stringify(step.args)) + CALL_OVERHEAD_TOKENS;
				if (isError) errors += 1;
			}
			return { id: workflow.id, task: workflow.task, calls: steps.length, tokens, errors };
		});
}

function readJson<T>(name: string): T {
	return JSON.parse(readFileSync(resolve(BENCH_DIR, name), 'utf8')) as T;
}

const dev = readJson<{ queries: BenchQuery[]; plans: BenchPlan[] }>('dev-queries.json');
/** Blind sets, each labelled without sight of the engine: `holdout` before the ranking work, `holdout2` after it. */
function optionalSet(name: string): BenchQuery[] {
	try {
		return readJson<{ queries: BenchQuery[] }>(name).queries;
	} catch {
		return [];
	}
}
const holdout = optionalSet('holdout-queries.json');
const holdout2 = optionalSet('holdout2-queries.json');
const workflows = readJson<{ workflows: Workflow[] }>('workflows.json').workflows;

const variants = [...new Set(workflows.flatMap((workflow) => Object.keys(workflow.variants)))];
const report = {
	registryVersion: registry.version,
	patterns: registry.patterns.length,
	relevance: {
		dev: relevance(dev.queries),
		holdout: holdout.length > 0 ? relevance(holdout) : null,
		holdout2: holdout2.length > 0 ? relevance(holdout2) : null,
	},
	plans: planQuality(dev.plans),
	responseTokens: responseSizes(dev.queries, dev.plans),
	latency: latency(dev.queries, dev.plans),
	workflows: Object.fromEntries(variants.map((variant) => [variant, runWorkflows(workflows, variant)])),
};

const argv = process.argv.slice(2);
const writeAt = argv.indexOf('--write');
const compareAt = argv.indexOf('--compare');
if (writeAt !== -1) {
	writeFileSync(resolve(ROOT, argv[writeAt + 1]), `${JSON.stringify(report, null, '\t')}\n`);
}
console.log(JSON.stringify(report, null, 2));
if (compareAt !== -1) {
	const before = JSON.parse(readFileSync(resolve(ROOT, argv[compareAt + 1]), 'utf8')) as typeof report;
	const line = (label: string, a: number, b: number) =>
		`${label.padEnd(34)} ${String(a).padStart(8)} → ${String(b).padStart(8)}  (${a === 0 ? 'n/a' : `${Math.round((100 * (b - a)) / a)}%`})`;
	const out = [
		'',
		'## Comparison (before → after)',
		line('dev Acc@1 %', before.relevance.dev.accuracyAt1, report.relevance.dev.accuracyAt1),
		line('dev Recall@3 %', before.relevance.dev.recallAt3, report.relevance.dev.recallAt3),
		line('dev MRR@10', before.relevance.dev.mrrAt10, report.relevance.dev.mrrAt10),
	];
	if (before.relevance.holdout && report.relevance.holdout) {
		out.push(
			line('holdout Acc@1 %', before.relevance.holdout.accuracyAt1, report.relevance.holdout.accuracyAt1),
			line('holdout Recall@3 %', before.relevance.holdout.recallAt3, report.relevance.holdout.recallAt3),
			line('holdout MRR@10', before.relevance.holdout.mrrAt10, report.relevance.holdout.mrrAt10),
		);
	}
	out.push(line('tools/list ≈tok', before.responseTokens.toolsList, report.responseTokens.toolsList));
	for (const tool of ['search_patterns', 'trace_capability', 'get_pattern_deep', 'recommend_emulation_plan'] as const) {
		out.push(line(`${tool} mean ≈tok`, before.responseTokens[tool].mean, report.responseTokens[tool].mean));
	}
	for (const tool of ['search_patterns', 'get_pattern', 'recommend_emulation_plan'] as const) {
		out.push(line(`${tool} p95 µs`, before.latency[tool].p95us, report.latency[tool].p95us));
	}
	const baseline = before.workflows.baseline ?? [];
	for (const [variant, rows] of Object.entries(report.workflows)) {
		for (const row of rows) {
			const prior = baseline.find((entry) => entry.id === row.id);
			if (prior)
				out.push(line(`${row.id} ${variant} ≈tok (calls ${prior.calls}→${row.calls})`, prior.tokens, row.tokens));
		}
	}
	console.log(out.join('\n'));
}
