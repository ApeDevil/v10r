/**
 * Replays the composition scenarios against an EARLIER checkout of the registry and planner, so a
 * stored run can be rescored when expectations are corrected or scenarios are added
 * (`composition-bench.ts --rescore`). A tree from before Slice 1 predates leveled needs: its plan
 * prints one "This plan requires: <technologies>" line (`legacy`), and its facts are the transitive
 * `requires` of the golden steps, all at the required level (that registry had no other level). A
 * later tree prints needs by level (`levels`), and its facts come from its own `adoptionNeeds`.
 *
 *   git worktree add /tmp/v10r-at-45d883b 45d883b
 *   bun scripts/patterns/composition-replay.ts /tmp/v10r-at-45d883b pattern-library/bench/composition-baseline-plans.json
 *
 * Golden ids are today's; the reconciliation manifest maps them back to the earlier ids.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '../..');
const [tree, out] = process.argv.slice(2);
if (!tree || !out) throw new Error('usage: composition-replay.ts <earlier worktree> <output.json>');

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

interface LegacyRecord {
	id: string;
	depends_on: string[];
	requires?: string[];
	needs?: unknown[];
}

const { loadRegistry } = (await import(resolve(tree, 'pattern-library/load.ts'))) as {
	loadRegistry: () => { registry: { patterns: LegacyRecord[] } | null };
};
const { REGISTRY_QUERIES } = (await import(resolve(tree, 'pattern-library/query.ts'))) as {
	REGISTRY_QUERIES: { recommend_emulation_plan: (registry: unknown, args: unknown) => { text: string } };
};
const { registry } = loadRegistry();
if (!registry) throw new Error('earlier registry did not load');
const byId = new Map(registry.patterns.map((pattern) => [pattern.id, pattern]));

const manifestPath = resolve(ROOT, 'pattern-library/reconciliation/manifest.json');
const manifest = existsSync(manifestPath)
	? (JSON.parse(readFileSync(manifestPath, 'utf8')) as { entries: { previousId: string; target: string }[] })
	: { entries: [] };
const earlierIds = (id: string) => [
	...(byId.has(id) ? [id] : []),
	...manifest.entries
		.filter((entry) => entry.target === id && byId.has(entry.previousId))
		.map((entry) => entry.previousId),
];

const leveled = registry.patterns.some((pattern) => Array.isArray(pattern.needs));
const adoption = leveled
	? ((await import(resolve(tree, 'pattern-library/infrastructure-needs.ts'))) as {
			adoptionNeeds: (pattern: unknown, byId: Map<string, unknown>) => { need: string; level: string }[];
		})
	: undefined;

function leveledFacts(ids: string[]): Record<string, string> {
	const order = ['required', 'conditional'];
	const found: Record<string, string> = {};
	for (const id of ids.flatMap(earlierIds)) {
		const record = byId.get(id);
		if (!record || !adoption) continue;
		for (const need of adoption.adoptionNeeds(record, byId)) {
			if (!order.includes(need.level)) continue;
			const known = found[need.need];
			if (!known || order.indexOf(need.level) < order.indexOf(known)) found[need.need] = need.level;
		}
	}
	return found;
}

function facts(ids: string[]): Record<string, 'required'> {
	const found: Record<string, 'required'> = {};
	const seen = new Set<string>();
	const queue = ids.flatMap(earlierIds);
	while (queue.length > 0) {
		const id = queue.shift() as string;
		if (seen.has(id)) continue;
		seen.add(id);
		const record = byId.get(id);
		if (!record) continue;
		for (const word of record.requires ?? []) found[LEGACY_NEED[word] ?? word] = 'required';
		queue.push(...record.depends_on);
	}
	return found;
}

const { scenarios } = JSON.parse(
	readFileSync(resolve(ROOT, 'pattern-library/bench/composition-scenarios.json'), 'utf8'),
) as {
	scenarios: { id: string; capabilities: string[]; required: string[] }[];
};
const plans: Record<string, { text: string; format: 'legacy' | 'levels'; facts: Record<string, string> }> = {};
for (const scenario of scenarios) {
	plans[scenario.id] = {
		text: REGISTRY_QUERIES.recommend_emulation_plan(registry, {
			capabilities: scenario.capabilities,
			detail: 'outline',
		}).text,
		format: leveled ? 'levels' : 'legacy',
		facts: leveled ? leveledFacts(scenario.required) : facts(scenario.required),
	};
}
const { createHash } = await import('node:crypto');
const commit = execSync('git rev-parse --short HEAD', { cwd: tree }).toString().trim();
writeFileSync(
	resolve(ROOT, out),
	`${JSON.stringify(
		{
			commit,
			registryDigest: createHash('sha256').update(JSON.stringify(registry)).digest('hex').slice(0, 16),
			plans,
		},
		null,
		'\t',
	)}\n`,
);
console.log(`replayed ${scenarios.length} scenarios at ${commit} → ${out}`);
