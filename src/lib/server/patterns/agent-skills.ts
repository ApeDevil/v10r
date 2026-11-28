/**
 * The pattern library as Agent Skills (https://agentskills.io/specification): the
 * registry rendered into installable agent skill directories under `skills/`, so an agent
 * that never connects to the Pattern MCP still gets v10r's curated knowledge
 * (`npx skills add ApeDevil/v10r`, or any loader that reads `skills/<name>/SKILL.md`).
 * Generated, never authored: the registry stays the one source; this is another view.
 *
 * Granularity — one agent skill per registry *group* (`v10r-<group-id>`, seven today) plus
 * `v10r-architecture-selection`, the entry point that explains how to choose. Why groups:
 *
 * - Startup cost. Every installed agent skill's name + description (~100-250 tokens) sits in
 *   the agent's context all the time. Per *category* would be 30 agent skills (~6k tokens
 *   resident, several with a single pattern); per *pattern* ~190. Eight is cheap.
 * - Activation precision. A group is a domain an agent can recognise from a task ("AI",
 *   "data", "performance"); a one-pattern category is too narrow to be worth a trigger.
 * - Body budget. The largest group's index (titles, maturity, one-line summary and
 *   use/avoid lines) fits the spec's <500 lines / <5000 tokens; the per-pattern detail
 *   lives in `references/<id>.md`, loaded only when the agent picks that pattern.
 *
 * References exist for DEEP records only: they are the ones with invariants and emulation
 * notes — the part worth carrying offline. Light records are index rows; the agent skill
 * lists them and links their GitHub docs page, exactly as the registry treats them.
 *
 * Pure and deterministic (no timestamps, registry order throughout); the script
 * `scripts/agent-skills/build.ts` owns all I/O. Vite-free leaf like `render.ts`.
 */
import { adoptionNeeds, declaredNeeds, needsSummary } from '#patterns/infrastructure-needs.ts';
import { registryDigest } from '#patterns/registry-digest.ts';
import { buildById, INFRASTRUCTURE_NEEDS, topoSort } from '#patterns/schema.ts';
import type { PatternRecord, RegGroup, Registry } from './registry';
import { clipAtWord, patternPageSourceUrl, renderPatternReference } from './render';

/** Repo-relative output directory — top level, where `npx skills add <repo>` looks. */
export const AGENT_SKILLS_DIR = 'skills';

/** The entry-point agent skill: how to choose among the group agent skills. */
export const SELECTION_AGENT_SKILL = 'v10r-architecture-selection';

const LICENSE = 'MIT';

/**
 * Budgets. The description is resident in every agent's context whether or not the agent
 * skill activates, so it stays well under the spec's 1024 ceiling. Index lines are clipped
 * so the largest group (Foundations, ~60 patterns) stays under the 5000-token body budget;
 * the full text is one click away in the reference or the docs page.
 */
const DESCRIPTION_MAX = 700;
const LIGHT_SUMMARY_MAX = 100;
const DEEP_LINE_MAX = 140;

const GENERATED_NOTE =
	'> Generated from `pattern-library/registry.json` by `scripts/agent-skills/build.ts` — do not edit; change the registry and run `bun run skills:build`.';

const PATTERN_MCP_URL = 'https://www.v10r.dev/api/mcp/public';

const MATURITY_LEGEND =
	'Maturity is evidence, not opinion: **proven** = a linked test or showcase, verified at a recorded date; **implemented** = the code exists but no proof surface is linked; **planned** = design only. Treat implemented and planned rows as unverified.';

/** The agent skill directory name for a registry group. */
export function agentSkillNameFor(groupId: string): string {
	return `v10r-${groupId}`;
}

function patternsInGroup(registry: Registry, groupId: string): PatternRecord[] {
	const categories = new Set(registry.categories.filter((c) => c.group === groupId).map((c) => c.id));
	return registry.patterns.filter((pattern) => categories.has(pattern.category));
}

function groupOf(registry: Registry, pattern: PatternRecord): string {
	return registry.categories.find((category) => category.id === pattern.category)?.group ?? '';
}

/** Join items into `head` + list, dropping trailing items until the text fits `max`. */
function fitList(head: string, items: string[], tail: string, max: number): string {
	for (let count = items.length; count > 0; count--) {
		const text = `${head}${items.slice(0, count).join(', ')}${tail}`;
		if (text.length <= max) return text;
	}
	return `${head.replace(/[:\s]+$/, '')}${tail}`;
}

function unique<T>(items: T[]): T[] {
	return [...new Set(items)];
}

function frontmatter(name: string, description: string, registry: Registry): string {
	return [
		'---',
		`name: ${name}`,
		`description: ${JSON.stringify(description)}`,
		`license: ${LICENSE}`,
		'metadata:',
		'  source: "v10r pattern-library registry"',
		`  registry-digest: ${JSON.stringify(registryDigest(registry))}`,
		'  generated: "true"',
		'---',
		'',
	].join('\n');
}

function groupDescription(registry: Registry, group: RegGroup): string {
	const categories = registry.categories.filter((c) => c.group === group.id).map((c) => c.title);
	const patterns = patternsInGroup(registry, group.id);
	const deep = patterns.filter((p) => p.tier === 'deep').length;
	const head = `v10r reference patterns for ${group.title} in SvelteKit + TypeScript apps (${categories.join('; ')}). Use when designing, building or reviewing: `;
	const tail = ` — before writing it from scratch, read the matching pattern's contraindications, invariants and emulation notes. ${patterns.length} patterns, ${deep} with full emulation cards.`;
	const capabilities = unique(patterns.flatMap((p) => p.capabilities.slice(0, 1)));
	return fitList(head, capabilities, tail, DESCRIPTION_MAX);
}

function maturityTag(pattern: PatternRecord): string {
	const maturity = pattern.maturity === 'proven' ? 'proven' : `**${pattern.maturity}**`;
	return pattern.kind === 'pattern' ? maturity : `${pattern.kind}, ${maturity}`;
}

function indexRow(pattern: PatternRecord): string[] {
	const own = needsSummary(declaredNeeds(pattern));
	const needs = own.length > 0 ? ` · needs ${own}` : '';
	if (pattern.tier === 'light') {
		return [
			`- ${pattern.title} (\`${pattern.id}\`, ${maturityTag(pattern)}) — ${clipAtWord(pattern.summary, LIGHT_SUMMARY_MAX)}`,
		];
	}
	const rows = [
		`- **[${pattern.title}](references/${pattern.id}.md)** (${maturityTag(pattern)}${needs}) — ${clipAtWord(pattern.summary, DEEP_LINE_MAX)}`,
		`  - ${clipAtWord(pattern.when_to_use, DEEP_LINE_MAX)}`,
	];
	if (pattern.avoid_when.length > 0) rows.push(`  - Avoid when: ${clipAtWord(pattern.avoid_when[0], DEEP_LINE_MAX)}`);
	return rows;
}

function renderGroupSkill(registry: Registry, group: RegGroup): string {
	const name = agentSkillNameFor(group.id);
	const patterns = patternsInGroup(registry, group.id);
	const categories = registry.categories.filter((c) => c.group === group.id);
	const lines: string[] = [
		frontmatter(name, groupDescription(registry, group), registry),
		`# v10r ${group.title} patterns`,
		'',
		GENERATED_NOTE,
		'',
		'## When to use',
		'',
		`Use this agent skill when a task in a SvelteKit + TypeScript project touches ${categories.map((c) => c.title).join(', ')} and a proven reference implementation would beat inventing one. v10r is a pattern library for *emulation*, not cloning: adapt the shape and keep the invariants; do not copy files wholesale.`,
		'',
		`To choose among patterns across groups, or to order several, use the \`${SELECTION_AGENT_SKILL}\` agent skill first.`,
		'',
		'## Method',
		'',
		'1. Find the candidate in the index below. Bold, linked rows are deep cards; the rest are index rows.',
		'2. Fitness first: read its *Avoid when* and *Alternatives*. If the target matches a contraindication, or a simpler alternative fits, stop here — the smallest thing that works wins.',
		"3. Check *Requires* against the target project's infrastructure, and *Depends on* for prerequisites to build first.",
		'4. Deep card: open `references/<id>.md`. Every *Invariant* MUST still hold after you adapt it; the *Emulation notes* say what to change for a new project. Read the linked docs and code on GitHub when you need the real implementation.',
		`5. Index row (no reference file): its docs page is \`${patternPageSourceUrl('<id>')}\` — pointers to docs, code and proof, but no recorded invariants, so treat it as orientation, not a contract.`,
		`6. When the v10r Pattern MCP is connected (\`${PATTERN_MCP_URL}\`, or the local stdio server), \`get_pattern {ids, sections}\` returns the live card and \`get_file_excerpt\` the cited code; prefer it over these generated copies.`,
		'',
		MATURITY_LEGEND,
		'',
		'## Pattern index',
	];
	for (const category of categories) {
		const inCategory = patterns.filter((p) => p.category === category.id);
		if (inCategory.length === 0) continue;
		lines.push('', `### ${category.title}`, '');
		for (const pattern of inCategory) lines.push(...indexRow(pattern));
	}
	lines.push('');
	return lines.join('\n');
}

function renderSelectionSkill(registry: Registry): string {
	const description = fitList(
		'Choose which v10r SvelteKit reference patterns to emulate, and in what order, for a new project or a new capability. Use when planning an app architecture or a feature that spans several concerns (',
		registry.groups.map((g) => g.title),
		`), before reading any single pattern: it maps the ${registry.patterns.length} registry patterns to the v10r group agent skills, explains infrastructure needs and depends_on, and how to use the v10r Pattern MCP tools recommend_emulation_plan and get_pattern when connected.`,
		1024,
	);
	const lines: string[] = [
		frontmatter(SELECTION_AGENT_SKILL, description, registry),
		'# Choosing v10r patterns',
		'',
		GENERATED_NOTE,
		'',
		'## When to use',
		'',
		'Use this before any v10r group agent skill when the task is "what should this project be built from?" — a new app, a feature that crosses domains, or a review of whether an existing design over-reaches. It is the routing layer; the pattern detail lives in the group agent skills.',
		'',
		'## Method',
		'',
		'1. **Name the capabilities** the project needs, in plain words ("background jobs", "layered RAG", "rate limiting").',
		`2. **Name the target infrastructure** using the registry's closed vocabulary of capabilities: ${INFRASTRUCTURE_NEEDS.map(
			(entry) => `\`${entry.id}\``,
		).join(
			', ',
		)} (a technology such as \`postgres\` or \`redis\` also works). Unknown is not the same as missing — ask rather than assume. Each pattern states its needs by level: *required*, *conditional* (with the condition), *optional*, or *v10r's implementation uses* (not needed to emulate it).`,
		'3. **With the v10r Pattern MCP connected** (hosted `' +
			PATTERN_MCP_URL +
			'`, or the local stdio server in `mcp/`):',
		"   - `recommend_emulation_plan {capabilities, target_infra}` returns a dependency-ordered plan; each step carries its contraindications, its infrastructure needs by level (including what its dependencies require) and a fit verdict against `target_infra`. It never drops a step itself — you do, when a step's *Avoid when* describes the target.",
		'   - `get_pattern {ids, sections: ["fitness", "invariants", "emulation_notes"]}` reads up to five cards at once; `search_patterns {query: "*"}` lists the category map.',
		'4. **Without the MCP**, do the same by hand:',
		'   - find candidates in the group agent skills below (each has a full pattern index);',
		'   - expand every candidate through *depends on* — [references/dependency-graph.md](references/dependency-graph.md) lists every edge and a build order;',
		"   - union the *required* and *conditional* needs of the whole set, including the dependencies', and compare them with the target (an *optional* or *v10r's implementation uses* need never rules a pattern out);",
		'   - drop any pattern whose *Avoid when* matches, and prefer a listed *Alternative* when its condition holds.',
		"5. **Build in dependency order**, one pattern at a time, keeping each deep card's invariants.",
		'',
		'Fewer patterns is the better plan: catalogs over-recommend, and every adopted pattern is code the project must own.',
		'',
		MATURITY_LEGEND,
		'',
		'## Group agent skills',
		'',
		'| Agent skill | Covers | Patterns (deep) |',
		'|---|---|---|',
	];
	for (const group of registry.groups) {
		const patterns = patternsInGroup(registry, group.id);
		const categories = registry.categories.filter((c) => c.group === group.id).map((c) => c.title);
		const deep = patterns.filter((p) => p.tier === 'deep').length;
		lines.push(`| \`${agentSkillNameFor(group.id)}\` | ${categories.join(', ')} | ${patterns.length} (${deep}) |`);
	}
	lines.push('');
	return lines.join('\n');
}

function renderDependencyGraph(registry: Registry): string {
	const byId = buildById(registry);
	const connected = new Set<string>();
	for (const pattern of registry.patterns) {
		if (pattern.depends_on.length === 0) continue;
		connected.add(pattern.id);
		for (const dep of pattern.depends_on) connected.add(dep);
	}
	// The Kahn toposort the MCP plan assembler and patterns:validate use, so a by-hand plan
	// and a tool plan come out in the same order.
	const { order } = topoSort(
		[...connected],
		byId,
		registry.patterns.map((p) => p.id),
	);
	const lines: string[] = [
		'# v10r pattern dependency graph',
		'',
		GENERATED_NOTE,
		'',
		"Every pattern that depends on another or is depended on, in a valid build order (prerequisites first, ties in registry order). *Needs* are the pattern's own infrastructure needs by level; adopting it also takes the required and conditional needs of everything it depends on.",
		'',
		'| # | Pattern | Agent skill | Depends on | Needs |',
		'|---|---|---|---|---|',
	];
	order.forEach((id, index) => {
		const pattern = byId.get(id) as PatternRecord;
		const deps = pattern.depends_on.map((dep) => `\`${dep}\``).join(', ') || '—';
		const needs = needsSummary(declaredNeeds(pattern)) || '—';
		lines.push(
			`| ${index + 1} | \`${id}\` (${pattern.tier}) | \`${agentSkillNameFor(groupOf(registry, pattern))}\` | ${deps} | ${needs} |`,
		);
	});
	lines.push('', '## Infrastructure → patterns', '');
	for (const entry of INFRASTRUCTURE_NEEDS) {
		const users = registry.patterns
			.map((p) => ({ id: p.id, need: adoptionNeeds(p, byId).find((need) => need.need === entry.id) }))
			.filter(({ need }) => need !== undefined && (need.level === 'required' || need.level === 'conditional'))
			.map(({ id, need }) => `\`${id}\`${need?.level === 'conditional' ? ' (conditional)' : ''}`);
		if (users.length > 0) lines.push(`- **${entry.id}** (${entry.title}; v10r: ${entry.binding}): ${users.join(', ')}`);
	}
	lines.push('');
	return lines.join('\n');
}

function renderHub(registry: Registry): string {
	const lines: string[] = [
		'# v10r Agent Skills',
		'',
		GENERATED_NOTE,
		'',
		'The v10r pattern library packaged as [Agent Skills](https://agentskills.io/specification): one agent skill per registry group plus a selection entry point. Everything here is generated from the registry — the same source as the `docs/pattern-library/` pages and the Pattern MCP — so it cannot drift from them. Deep patterns ship as `references/<id>.md` inside their group; index rows link their docs page on GitHub.',
		'',
		'Install into a coding agent (Claude Code, Codex, Cursor and other Agent Skills loaders):',
		'',
		'```bash',
		`npx skills add ApeDevil/v10r --skill ${SELECTION_AGENT_SKILL}   # the entry point`,
		'npx skills add ApeDevil/v10r --skill v10r-intelligence           # or any group',
		'```',
		'',
		'Pass `--skill` explicitly: the repo also holds its own development skills under `.claude/skills/`, which are not part of this package.',
		'',
		'| Agent skill | Covers | Patterns (deep) |',
		'|---|---|---|',
		`| [\`${SELECTION_AGENT_SKILL}\`](${SELECTION_AGENT_SKILL}/SKILL.md) | how to choose and order patterns | ${registry.patterns.length} |`,
	];
	for (const group of registry.groups) {
		const name = agentSkillNameFor(group.id);
		const patterns = patternsInGroup(registry, group.id);
		const categories = registry.categories.filter((c) => c.group === group.id).map((c) => c.title);
		const deep = patterns.filter((p) => p.tier === 'deep').length;
		lines.push(`| [\`${name}\`](${name}/SKILL.md) | ${categories.join(', ')} | ${patterns.length} (${deep}) |`);
	}
	lines.push('');
	return lines.join('\n');
}

/**
 * Every generated file, keyed by its path under `skills/`, in a stable order: the hub,
 * then the selection agent skill, then each group agent skill with its references.
 */
export function renderAgentSkills(registry: Registry): Map<string, string> {
	const files = new Map<string, string>();
	files.set('README.md', renderHub(registry));
	files.set(`${SELECTION_AGENT_SKILL}/SKILL.md`, renderSelectionSkill(registry));
	files.set(`${SELECTION_AGENT_SKILL}/references/dependency-graph.md`, renderDependencyGraph(registry));
	for (const group of registry.groups) {
		const name = agentSkillNameFor(group.id);
		const patterns = patternsInGroup(registry, group.id);
		files.set(`${name}/SKILL.md`, renderGroupSkill(registry, group));
		const deepHere = new Set(patterns.filter((p) => p.tier === 'deep').map((p) => p.id));
		for (const pattern of patterns) {
			if (pattern.tier !== 'deep') continue;
			// A sibling reference when the dependency ships in this agent skill; its GitHub page otherwise.
			const dependencyHref = (id: string) => (deepHere.has(id) ? `${id}.md` : patternPageSourceUrl(id));
			files.set(
				`${name}/references/${pattern.id}.md`,
				renderPatternReference(pattern, registry, GENERATED_NOTE, dependencyHref),
			);
		}
	}
	return files;
}
