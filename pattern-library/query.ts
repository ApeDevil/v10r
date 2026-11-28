/**
 * The registry query layer: the tool contract and the four registry tools of the Pattern MCP
 * (search_patterns, get_pattern, trace_capability, recommend_emulation_plan), written ONCE.
 * The two Architecture Engineering tools (explore_architecture, check_architecture) live in
 * `architecture-queries.ts` under the same contract and are merged in here.
 *
 * Both transports are thin readers over this module — the stdio server (`mcp/tools.ts`, by
 * relative path under bare Bun) and the hosted one (`src/lib/server/mcp/patterns/tools.ts`,
 * through `$patterns`). What stays per transport is only what genuinely differs: how a file is
 * read for `get_file_excerpt`, the `validate_snippet` engine, and how an outcome becomes a wire
 * result (the hosted side keeps `diag` for telemetry). Parity is therefore by construction, and
 * `src/lib/server/mcp/patterns/parity.test.ts` proves it by running both.
 *
 * Every handler returns a `QueryOutcome`; a failure must name its recovery steps (`next`), so a
 * branch that strands the caller is a type error, not a review miss.
 * Framework-free and filesystem-free, like `schema.ts`.
 */

import { ARCHITECTURE_QUERIES, ARCHITECTURE_TOOLS } from './architecture-queries.ts';
import { EXPLORE_PATTERNS_TOOL, explorePatterns } from './dependency-explorer.ts';
import { DEFAULT_LINES, type ExcerptRequest, MAX_LINES } from './excerpt.ts';
import { needsSummary, TARGET_INFRA_WORDS } from './infrastructure-needs.ts';
import { type PatternGraph, patternGraph, type ResolvedNeed } from './pattern-graph.ts';
import {
	assemble,
	type Candidate,
	discover,
	type NeedStatus,
	type Plan,
	type PlanStep,
	type Selection,
	select as selectRecord,
} from './planner.ts';
import { MAX_ARG_CHARS, type NextAction, type QueryDiag, type QueryOutcome, type ToolDef } from './query-contract.ts';
import type { PatternRecord, Registry, RegRef } from './schema.ts';
import { ADOPTION_SEMANTICS, type NEED_LEVELS } from './schema.ts';
import { type Scored, scorePatterns } from './search.ts';

export {
	MAX_ARG_CHARS,
	MAX_NEXT_ACTIONS,
	NEXT_ACTIONS_HEADING,
	type NextAction,
	type QueryDiag,
	type QueryOutcome,
	type ToolDef,
	withNextActions,
} from './query-contract.ts';

/**
 * Argument bounds. They appear in `inputSchema` so the contract is honest, but nothing in either
 * transport validates against the schema — the enforcement is in the handlers, and the schema
 * entries exist so a well-behaved client self-limits rather than discovering the bound as an error.
 *
 * `MAX_CAPABILITIES` is load-bearing rather than tidy: `recommendPlan` scores the registry once
 * per entry, so an unbounded array is a CPU amplifier reachable without credentials on the
 * hosted endpoint. 256 KB of one-character strings is still tens of thousands of entries.
 */
export const MAX_CAPABILITIES = 20;
/** Search hits per call. 50 covers any one category; `detail: "ids"` keeps that around 1k tokens. */
const MAX_RESULTS = 50;
/** Cards per get_pattern call: a deep card is ~850 tokens, so five stay under Claude Code's 10k warning. */
const MAX_CARDS = 5;
/** Several cards past this are shown header-only from the first that would cross it (≈9k tokens). */
const CARDS_BUDGET_CHARS = 36_000;

/**
 * What the TARGET project already runs: infrastructure need ids or the technologies that provide
 * them (`INFRASTRUCTURE_NEEDS`). Absent means unknown — rows then state needs without a verdict;
 * present, every step says whether the target has what it needs, its dependencies' needs included.
 */
const TARGET_INFRA_SCHEMA = {
	type: 'array',
	items: { type: 'string', enum: TARGET_INFRA_WORDS },
	description:
		'What the target project HAS — capabilities or technologies, e.g. ["relational-db"] or ["postgres", "redis"] ([] = none); each step then says whether it fits.',
};

const PLAN_DETAILS = ['compact', 'full'] as const;
/** Above this a full plan is outlined instead (≈8k tokens, under Claude Code's 10k warning). */
const PLAN_BUDGET_CHARS = 32_000;

/** `search_patterns` query that browses (facets) instead of ranking. */
const BROWSE_QUERY = '*';

/** Graduated search detail — the progressive-disclosure ladder, cheapest first. */
const SEARCH_DETAILS = ['ids', 'compact', 'summary'] as const;
type SearchDetail = (typeof SEARCH_DETAILS)[number];

/** The parts of a card `get_pattern` can return selectively. The header is not one: it is always shown. */
const CARD_SECTIONS = [
	'overview',
	'fitness',
	'docs',
	'code',
	'tests',
	'showcases',
	'invariants',
	'emulation_notes',
] as const;
type CardSection = (typeof CARD_SECTIONS)[number];

/** Reject rather than truncate: a silently shortened query returns confidently wrong results. */
function boundedString(value: unknown, max = MAX_ARG_CHARS): string | null {
	if (typeof value !== 'string') return null;
	return value.length > max ? null : value;
}

const ok = (text: string): QueryOutcome => ({ ok: true, text });
const failure = (text: string, diag: QueryDiag, next: readonly NextAction[]): QueryOutcome => ({
	ok: false,
	text,
	diag,
	next,
});

/** The tools this module owns plus `get_file_excerpt`, whose contract is shared even though each
 *  transport reads files its own way. Each transport appends its own `validate_snippet`. */
export const QUERY_TOOLS: ToolDef[] = [
	{
		name: 'search_patterns',
		description:
			'Search the v10r pattern library by capability, feature, or concept — start here to find which proven pattern to emulate, then get_pattern. Hits are graded strong/partial/weak; weak-only means no pattern covers it. query "*" browses: the category map, or the patterns a filter selects.',
		inputSchema: {
			type: 'object',
			additionalProperties: false,
			properties: {
				query: {
					type: 'string',
					maxLength: MAX_ARG_CHARS,
					description:
						'Natural-language or keyword query describing the capability you are looking for — e.g. "background jobs", "approval gate for AI tools", "grounded answers over a corpus".',
				},
				limit: {
					type: 'integer',
					minimum: 1,
					maximum: MAX_RESULTS,
					default: 5,
					description: `Max results (1-${MAX_RESULTS}). Default 5 (browse: ${MAX_RESULTS}).`,
				},
				detail: {
					type: 'string',
					enum: SEARCH_DETAILS,
					default: 'summary',
					description: 'ids | compact (+ requires, depends on, avoid when) | summary (default; + summary sentence).',
				},
				category: {
					type: 'string',
					maxLength: MAX_ARG_CHARS,
					description: 'Optional exact category filter — use a category value from any search result.',
				},
				tier: { type: 'string', enum: ['deep', 'light'], description: 'deep = full emulation cards.' },
				maturity: { type: 'string', enum: ['proven', 'implemented', 'planned'] },
			},
			required: ['query'],
		},
	},
	{
		name: 'get_pattern',
		description:
			"Fetch a pattern's curated card: when to use and when NOT to (contraindications, alternatives, required infrastructure), docs, code entry points, tests, showcase proof, invariants that MUST hold when emulating, emulation notes. ids = several cards; sections = part of each (omissions are listed).",
		inputSchema: {
			type: 'object',
			additionalProperties: false,
			properties: {
				id: {
					type: 'string',
					maxLength: MAX_ARG_CHARS,
					description: 'Exact pattern id from search_patterns results, e.g. "layered-rag" or "multi-client-core".',
				},
				ids: {
					type: 'array',
					items: { type: 'string', maxLength: MAX_ARG_CHARS },
					minItems: 1,
					maxItems: MAX_CARDS,
					description: `Instead of id: up to ${MAX_CARDS} ids.`,
				},
				sections: {
					type: 'array',
					items: { type: 'string', enum: CARD_SECTIONS },
					minItems: 1,
					description: 'Only these card parts (default all); the header (risk, depends on, requires) always shows.',
				},
			},
		},
	},
	{
		name: 'get_file_excerpt',
		description:
			'Read a bounded, line-numbered excerpt of a reference file. Use the repo-relative paths returned by get_pattern or trace_capability; on the hosted endpoint only files referenced by deep pattern cards can be read.',
		inputSchema: {
			type: 'object',
			additionalProperties: false,
			properties: {
				path: {
					type: 'string',
					maxLength: MAX_ARG_CHARS,
					description:
						'Repo-relative path from a pattern card, e.g. "src/lib/server/ai/tools/index.ts" — a "#heading" suffix as cards print it reads that section. Absolute paths, ".." traversal and secret files (.env, *.pem, .git/, node_modules/) are rejected.',
				},
				section: {
					type: 'string',
					maxLength: MAX_ARG_CHARS,
					description:
						'Read one block instead of a line range: a markdown heading (text or slug) or a code declaration name. Unknown names list the real ones.',
				},
				start_line: { type: 'integer', minimum: 1, default: 1, description: '1-based line to start from. Default 1.' },
				line_count: {
					type: 'integer',
					minimum: 1,
					maximum: MAX_LINES,
					default: DEFAULT_LINES,
					description: `Number of lines to return (1-${MAX_LINES}). Default ${DEFAULT_LINES}.`,
				},
			},
			required: ['path'],
		},
	},
	{
		name: 'trace_capability',
		description:
			'Trace a capability end-to-end through v10r: concept → docs → code → tests → showcase proof, with the invariants attached. Use it to understand how a capability is actually wired before emulating it.',
		inputSchema: {
			type: 'object',
			additionalProperties: false,
			properties: {
				capability: {
					type: 'string',
					maxLength: MAX_ARG_CHARS,
					description:
						'The capability or concept to trace — e.g. "deskbot approval gate", "rag ingest", "design tokens".',
				},
			},
			required: ['capability'],
		},
	},
	{
		name: 'recommend_emulation_plan',
		description:
			'Plan an emulation in three explained stages: discovery and selection turn each capability into one record (or report it ambiguous, with candidates and a recovery call — nothing is guessed), canonical "ids" skip both, and assembly deterministically adds prerequisites, constituents, specializations, principles, assumptions, infrastructure, pins, order and the reason for every step. Patterns are implemented, workflows performed, principles applied (never steps). Conditional constituents stay open decisions until "conditions" settles them by id; optional ones are adopted only via "select" or an explicit request. Compact by default.',
		inputSchema: {
			type: 'object',
			additionalProperties: false,
			properties: {
				capabilities: {
					type: 'array',
					items: { type: 'string', maxLength: MAX_ARG_CHARS },
					minItems: 1,
					maxItems: MAX_CAPABILITIES,
					description: `What the target needs, in words (1-${MAX_CAPABILITIES}) — e.g. ["grounded answers", "background jobs"]. Each is selected separately and the selection explained.`,
				},
				ids: {
					type: 'array',
					items: { type: 'string', maxLength: MAX_ARG_CHARS },
					minItems: 1,
					maxItems: MAX_CAPABILITIES,
					description:
						'Canonical record ids to plan exactly (from search_patterns or get_pattern): validated, never aliased; unknown ids are reported. With capabilities, both sets of roots are planned together and shared parts appear once.',
				},
				conditions: {
					type: 'array',
					maxItems: MAX_RESULTS,
					items: {
						type: 'object',
						additionalProperties: false,
						properties: {
							id: {
								type: 'string',
								maxLength: MAX_ARG_CHARS,
								description: 'A condition id a plan printed, e.g. "layered-rag/composes/graph-rag".',
							},
							state: { type: 'string', enum: ['satisfied', 'unsatisfied'] },
						},
						required: ['id', 'state'],
					},
					description:
						'Settled conditions, by the id a plan prints; leave unknown ones out. A satisfied condition makes a conditional constituent or need required; it never adopts an optional one.',
				},
				select: {
					type: 'array',
					items: { type: 'string', maxLength: MAX_ARG_CHARS },
					maxItems: MAX_CAPABILITIES,
					description: 'Optional or conditional constituents to adopt, by id.',
				},
				exclude: {
					type: 'array',
					items: { type: 'string', maxLength: MAX_ARG_CHARS },
					maxItems: MAX_CAPABILITIES,
					description:
						'Record ids the target refuses; a step that requires one is reported as a conflict, never dropped silently.',
				},
				target_infra: TARGET_INFRA_SCHEMA,
				target_lacks: {
					type: 'array',
					items: { type: 'string', enum: TARGET_INFRA_WORDS },
					description:
						'Infrastructure the target is known NOT to have. Steps that require it are reported blocked, with what stands on them. A need in neither list is unknown, never assumed absent.',
				},
				target_has: {
					type: 'array',
					items: { type: 'string', maxLength: MAX_ARG_CHARS },
					maxItems: MAX_RESULTS,
					description: 'Record ids the target already has an equivalent of: satisfied, never built again.',
				},
				detail: {
					type: 'string',
					enum: PLAN_DETAILS,
					default: 'compact',
					description:
						'compact (default) = steps, reasons, fitness and every decision; full adds docs, code, tests and invariants per step.',
				},
			},
		},
	},
	EXPLORE_PATTERNS_TOOL,
	...ARCHITECTURE_TOOLS,
];

/**
 * How to use the eight tools, for the `initialize` instructions of BOTH transports — each wraps it
 * in its own framing. Claude Code loads server instructions upfront (cut at 4,096 characters),
 * so this is the one place the progressive path is taught before any tool is called.
 */
export const QUERY_WORKFLOW =
	'Discover, select, assemble. Discover: search_patterns (query "*" maps the categories; detail "compact" adds ' +
	"each record's requirements and headline contraindication; weak-only means no record covers it), trace_capability " +
	'(owners of a capability first, then related records), explore_patterns (the relationship graph). Select: get_pattern ' +
	'for cards (ids for several, sections for part of one; invariants MUST hold when emulating) and choose canonical ids. ' +
	'Assemble: recommend_emulation_plan with "ids" for an exact, deterministic plan (or "capabilities" — each selected ' +
	'and explained, an ambiguous one returned with candidates); settle open conditions with "conditions" by the ids it ' +
	'prints, adopt optional parts with "select", describe the target with target_infra / target_lacks / target_has. ' +
	'Patterns are implemented, workflows performed, principles applied (never steps). get_file_excerpt for exact evidence ' +
	'(section = one heading or declaration); validate_snippet to check code you wrote (loop until clean); ' +
	'explore_architecture for an explained architecture recommendation (unknown factors stay unknown) and ' +
	'check_architecture to check a model.';

/**
 * `validate_snippet`'s definition. Its ENGINE is per transport (the stdio one adds a Bun syntax
 * pre-check), but its contract is not, so the definition is built here from the bound both
 * engines read out of `mcp/snippet-rules.json`.
 */
export function validateSnippetDef(maxSnippetChars: number): ToolDef {
	return {
		name: 'validate_snippet',
		description:
			'Validate a Svelte or TypeScript snippet against v10r conventions (Svelte 5 runes, component-first, design tokens, Valibot). Returns line-numbered findings with fixes — findings are a successful validation, not an error. Call in a loop: submit, apply the fixes, resubmit until it reports clean.',
		inputSchema: {
			type: 'object',
			additionalProperties: false,
			properties: {
				snippet: {
					type: 'string',
					maxLength: maxSnippetChars,
					description: `The code to validate (at most ${maxSnippetChars} characters — larger snippets are refused, never truncated).`,
				},
				language: {
					type: 'string',
					enum: ['svelte', 'ts'],
					default: 'svelte',
					description: "Snippet language. Default 'svelte'.",
				},
			},
			required: ['snippet'],
		},
	};
}

/** The recovery step for a path this tool cannot read: the cards list the paths it can. */
export const EXCERPT_RECOVERY: NextAction = {
	tool: 'get_pattern',
	why: 'pattern cards list the repo-relative paths this tool can read.',
};

/**
 * `get_file_excerpt`'s arguments, validated once for both transports (each then reads the file
 * its own way). Bounded like every other argument: the path is echoed into error text.
 */
export function excerptRequest(
	args: Record<string, unknown>,
): ({ ok: true; path: string } & ExcerptRequest) | { ok: false; text: string; next: readonly NextAction[] } {
	const path = boundedString(args.path);
	const section = args.section === undefined ? undefined : boundedString(args.section);
	if (path === null || section === null) {
		return {
			ok: false,
			text: `"path" and "section" must be strings of at most ${MAX_ARG_CHARS} characters.`,
			next: [EXCERPT_RECOVERY],
		};
	}
	return {
		ok: true,
		path,
		section: section?.trim() ? section : undefined,
		startLine: typeof args.start_line === 'number' ? args.start_line : undefined,
		lineCount: typeof args.line_count === 'number' ? args.line_count : undefined,
	};
}

/**
 * The universal fallback step: browsing with no filter returns the category map — every
 * category with its counts, from which any pattern is one filtered call away. (It used to be
 * `{query: "pattern"}`, which claimed to list the library and returned 14 of 175 records.)
 */
export const LIST_EVERYTHING: NextAction = {
	tool: 'search_patterns',
	args: { query: BROWSE_QUERY },
	why: 'lists every category with its pattern counts.',
};

/** Per-registry derived lookups, computed once per registry object rather than per call. */
interface RegistryView {
	byId: ReadonlyMap<string, PatternRecord>;
	graph: PatternGraph;
	/** What adopting each record takes, resolved through its foundations, constituents and generalizations. */
	needs: Map<string, ResolvedNeed[]>;
}

const views = new WeakMap<Registry, RegistryView>();

function viewOf(registry: Registry): RegistryView {
	let view = views.get(registry);
	if (!view) {
		const graph = patternGraph(registry);
		view = {
			byId: graph.byId,
			graph,
			needs: new Map(registry.patterns.map((pattern) => [pattern.id, graph.needs(pattern.id)])),
		};
		views.set(registry, view);
	}
	return view;
}

const bullets = (items: string[]) => items.map((item) => `- ${item}`).join('\n');

function refLines(refs: RegRef[]): string {
	if (refs.length === 0) return '- (none)';
	return refs.map((ref) => `- ${ref.path}${ref.note ? ` — ${ref.note}` : ''}`).join('\n');
}

/** Parse `target_infra`: absent → unknown (`null`); otherwise only vocabulary words are accepted. */
function targetOf(args: Record<string, unknown>): { ok: true; target: ReadonlySet<string> | null } | QueryOutcome {
	if (args.target_infra === undefined) return { ok: true, target: null };
	const values = Array.isArray(args.target_infra) ? args.target_infra : null;
	if (values === null || values.some((value) => !(TARGET_INFRA_WORDS as readonly unknown[]).includes(value))) {
		return failure(`"target_infra" must be an array of: ${TARGET_INFRA_WORDS.join(', ')}.`, 'invalid_args', [
			{
				tool: 'recommend_emulation_plan',
				args: { capabilities: ['background jobs'], target_infra: ['relational-db'] },
				why: 'a well-formed example call.',
			},
		]);
	}
	return { ok: true, target: new Set(values as string[]) };
}

/** Contraindications and alternatives — printed BEFORE the how on every card and plan step. */
function fitnessLines(pattern: PatternRecord): string[] {
	return [
		pattern.avoid_when.length > 0 ? `**Avoid when:**\n${bullets(pattern.avoid_when)}` : '',
		pattern.alternatives.length > 0
			? `**Alternatives:**\n${bullets(pattern.alternatives.map((alt) => `${alt.approach} — prefer when ${alt.prefer_when}`))}`
			: '',
	].filter((line) => line.length > 0);
}

function noMatchHelp(registry: Registry, what: string): string {
	const categories = [...new Set(registry.patterns.map((pattern) => pattern.category))].join(', ');
	const sample = registry.patterns
		.flatMap((pattern) => pattern.capabilities.slice(0, 1))
		.slice(0, 8)
		.join('", "');
	return `No pattern matched ${what}. Available categories: ${categories}. Example capability tags: "${sample}". Try broader terms, or browse with search_patterns query "${BROWSE_QUERY}".`;
}

/**
 * A no-match: the query ran and the registry had nothing STRONG for it. This is THE improvement
 * signal on the hosted side (`empty`) — a capability a consumer wanted that we do not cover, or
 * cover under words the registry does not use yet (a keyword to curate). Not every caller of
 * `noMatchHelp` is a no-match: an unknown category filter never ran a query, so it stays
 * `invalid_args` — otherwise a typo'd filter would pollute the capability-gaps report.
 *
 * Weak overlaps are SHOWN, not withheld: on paraphrased requests the right pattern is often among
 * them (measured on the holdout sets), so the answer says "check before concluding it is absent"
 * and points the next call at the closest candidate.
 */
function noMatch(
	registry: Registry,
	what: string,
	closest: readonly Scored[] = [],
	row: (hit: Scored, index: number) => string = (hit) =>
		`- \`${hit.pattern.id}\` — ${hit.pattern.title} (${matchLine(hit)})`,
): QueryOutcome {
	if (closest.length === 0) {
		return failure(noMatchHelp(registry, what), 'empty', [
			LIST_EVERYTHING,
			{ tool: 'trace_capability', args: { capability: 'rag' }, why: 'traces one capability end to end as a model.' },
		]);
	}
	return failure(
		`No strong match for ${what} — the registry may not cover it. These records share only some of its terms; read the closest before concluding it is absent:\n\n${closest.slice(0, 5).map(row).join('\n')}`,
		'empty',
		[
			{
				tool: 'get_pattern',
				args: { id: closest[0].pattern.id },
				why: 'the closest candidate — confirm it or rule it out.',
			},
			LIST_EVERYTHING,
		],
	);
}

/** `a, b (conditional: when …), c (optional: when …)` — constituents with their promise. */
function constituentList(pattern: PatternRecord): string {
	return pattern.composes
		.map((entry) => (entry.level === 'required' ? entry.id : `${entry.id} (${entry.level}: when ${entry.when})`))
		.join(', ');
}

/** The record's relationships as card lines: what it stands on, contains, narrows, cites, and the derived inverses. */
function relationshipLines(pattern: PatternRecord, graph: PatternGraph): string[] {
	const inverse = (type: 'builds_on' | 'composes' | 'specializes' | 'references') =>
		graph.edgesTo(pattern.id, type).map((edge) => edge.from);
	const builtOnBy = inverse('builds_on');
	// The inverse of a composition keeps its level: being an optional part of a whole is not being required by it.
	const partOf = graph
		.edgesTo(pattern.id, 'composes')
		.map((edge) => (edge.level === 'required' ? edge.from : `${edge.from} (${edge.level})`));
	const specializedBy = inverse('specializes');
	const referencedBy = inverse('references');
	const assumptions = graph.assumptionsFor(pattern.id);
	const principles = assumptions.filter((entry) => graph.byId.get(entry.id)?.kind === 'principle');
	const conventions = assumptions.filter((entry) => graph.byId.get(entry.id)?.kind !== 'principle');
	return [
		pattern.builds_on.length > 0 ? `**Builds on:** ${pattern.builds_on.map((entry) => entry.id).join(', ')}` : '',
		pattern.composes.length > 0 ? `**Composes:** ${constituentList(pattern)}` : '',
		pattern.specializes
			? `**Specializes:** ${pattern.specializes.id} — its invariants hold here and its foundations and constituents apply; it is not a second step`
			: '',
		pattern.references.length > 0
			? `**References:** ${pattern.references.map((entry) => entry.id).join(', ')} (context only, never a step)`
			: '',
		principles.length > 0 ? `**Applies:** ${principles.map((entry) => entry.id).join(', ')}` : '',
		conventions.length > 0
			? `**Assumes:** ${conventions.map((entry) => entry.id).join(', ')} (platform convention)`
			: '',
		partOf.length > 0 ? `**Part of:** ${partOf.join(', ')}` : '',
		builtOnBy.length > 0 ? `**Built on by:** ${builtOnBy.join(', ')}` : '',
		specializedBy.length > 0 ? `**Specialized by:** ${specializedBy.join(', ')}` : '',
		referencedBy.length > 0 ? `**Referenced by:** ${referencedBy.join(', ')} (context only)` : '',
	].filter((line) => line.length > 0);
}

/** The always-shown part of a card: identity, evidence grade, risk and how it relates. */
function cardHeader(pattern: PatternRecord, needs: ResolvedNeed[], graph: PatternGraph): string {
	const facts = [
		`**Kind:** ${pattern.kind} — ${ADOPTION_SEMANTICS[pattern.kind]}`,
		`**Category:** ${pattern.category} · **Tier:** ${pattern.tier} · **Maturity:** ${pattern.maturity}${pattern.verifiedAt ? ` (verified ${pattern.verifiedAt})` : ''} · **Risk:** ${pattern.risk}`,
		...relationshipLines(pattern, graph),
		needs.length > 0 ? `**Needs:** ${needsSummary(needs, { condition: true })}` : '',
	].filter((line) => line.length > 0);
	return `# ${pattern.title} (\`${pattern.id}\`)\n\n${facts.join('\n')}`;
}

/**
 * Invariants that hold because the record specializes another, per generalization. A
 * generalization whose own card, invariants included, is in the same response is pointed at
 * instead of repeated: the invariants are stated once, and still named with their count.
 */
function inheritedInvariantLines(
	pattern: PatternRecord,
	graph: PatternGraph,
	shownWithInvariants: ReadonlySet<string> = new Set(),
): string {
	return graph
		.inheritedInvariants(pattern.id)
		.map((entry) =>
			shownWithInvariants.has(entry.from)
				? `Inherited from \`${entry.from}\` (specializes): its ${entry.invariants.length} invariant(s), stated on its card in this response, hold here too.`
				: `Inherited from \`${entry.from}\` (specializes):\n${bullets(entry.invariants)}`,
		)
		.join('\n');
}

/**
 * One card section's text, or '' when the record has nothing for it. Light records are index
 * rows: they carry no invariants or emulation notes by contract, so those render as nothing
 * rather than as empty headings.
 */
function cardSection(
	pattern: PatternRecord,
	section: CardSection,
	graph: PatternGraph,
	shownWithInvariants?: ReadonlySet<string>,
): string {
	const light = pattern.tier === 'light';
	switch (section) {
		case 'overview':
			return `${pattern.summary}\n\n**When to use:** ${pattern.when_to_use}`;
		case 'fitness':
			// Needs live in the header, so a card filtered to one section never hides them.
			return fitnessLines(pattern).join('\n');
		case 'docs':
			return `## Docs to read\n${refLines(pattern.docs)}`;
		case 'code':
			return light && pattern.code.length === 0 ? '' : `## Code entry points\n${refLines(pattern.code)}`;
		case 'tests':
			return light && pattern.tests.length === 0 ? '' : `## Tests that pin it\n${refLines(pattern.tests)}`;
		case 'showcases':
			return light && pattern.showcases.length === 0 ? '' : `## Showcase proof\n${refLines(pattern.showcases)}`;
		case 'invariants': {
			const inherited = inheritedInvariantLines(pattern, graph, shownWithInvariants);
			return pattern.invariants.length > 0 || inherited.length > 0
				? `## Invariants (must hold when emulating)\n${[bullets(pattern.invariants), inherited].filter((part) => part.length > 0).join('\n')}`
				: '';
		}
		case 'emulation_notes':
			return pattern.emulation_notes.length > 0 ? `## Emulation notes\n${bullets(pattern.emulation_notes)}` : '';
	}
}

/**
 * A card, whole or in part. What a partial card leaves out is NAMED in a closing line, with
 * counts — selective disclosure must never read as "this pattern has no invariants".
 */
function patternCard(
	pattern: PatternRecord,
	needs: ResolvedNeed[],
	graph: PatternGraph,
	sections: readonly CardSection[] = CARD_SECTIONS,
	/** Other cards in the same response that show their invariants. */
	shownWithInvariants?: ReadonlySet<string>,
): string {
	const shown = sections
		.map((section) => cardSection(pattern, section, graph, shownWithInvariants))
		.filter((text) => text.length > 0);
	const withheld = CARD_SECTIONS.filter((section) => !sections.includes(section))
		.map((section) => ({ section, size: sectionSize(pattern, section) }))
		.filter(({ size }) => size > 0);
	const footer =
		withheld.length > 0
			? `_Not shown: ${withheld.map(({ section, size }) => `${section} (${size})`).join(', ')}${withheld.some(({ section }) => section === 'invariants') ? ' — the invariants MUST hold when emulating; read them before writing code' : ''}. Request them with sections._`
			: pattern.tier === 'light'
				? '_Index record — the docs above are the canonical explanation; deep-tier cards carry invariants and emulation notes._'
				: '';
	return [cardHeader(pattern, needs, graph), ...shown, footer].filter((part) => part.length > 0).join('\n\n');
}

/** How many entries a section holds — the count a withheld section is announced with. */
function sectionSize(pattern: PatternRecord, section: CardSection): number {
	switch (section) {
		case 'overview':
			return 1;
		case 'fitness':
			return pattern.avoid_when.length + pattern.alternatives.length;
		case 'emulation_notes':
			return pattern.emulation_notes.length;
		default:
			return pattern[section].length;
	}
}

function matchLine(hit: Scored): string {
	return `${hit.strength}: ${hit.matchedTerms.join(', ')}`;
}

/** One search row at the requested detail. `compact` is what ruling a pattern in or out needs. */
function searchRow(
	pattern: PatternRecord,
	index: number,
	detail: SearchDetail,
	needs: ResolvedNeed[],
	hit?: Scored,
): string {
	const strength = hit ? ` · ${hit.strength}` : '';
	if (detail === 'ids') return `${index + 1}. \`${pattern.id}\` — ${pattern.title}${strength}`;
	const fitness = [
		// Transitive: what adopting it really takes, its dependencies' infrastructure included.
		needs.length > 0 ? `needs ${needsSummary(needs)}` : '',
		pattern.builds_on.length > 0 ? `builds on ${pattern.builds_on.map((entry) => entry.id).join(', ')}` : '',
		pattern.composes.length > 0 ? `composes ${constituentList(pattern)}` : '',
		pattern.specializes ? `specializes ${pattern.specializes.id}` : '',
		pattern.avoid_when.length > 0 ? `avoid when: ${pattern.avoid_when[0]}` : '',
	].filter((part) => part.length > 0);
	const lines = [
		`${index + 1}. **${pattern.title}** (\`${pattern.id}\`, ${pattern.kind === 'pattern' ? '' : `${pattern.kind}, `}${pattern.category}, ${pattern.tier}, ${pattern.maturity})`,
		detail === 'summary' ? `   ${pattern.summary}` : '',
		fitness.length > 0 ? `   ${fitness.join(' · ')}` : '',
		hit ? `   _${matchLine(hit)}_` : '',
	];
	return lines.filter((line) => line.length > 0).join('\n');
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
	return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

/** `query: "*"` with no filter: the category map. Every pattern is one filtered call from here. */
function categoryMap(registry: Registry): string {
	const lines = registry.categories.map((category) => {
		const members = registry.patterns.filter((pattern) => pattern.category === category.id);
		const deep = members.filter((pattern) => pattern.tier === 'deep').length;
		return `- \`${category.id}\` — ${category.title}: ${members.length} pattern(s)${deep > 0 ? `, ${deep} deep` : ''}`;
	});
	return `The v10r pattern library: ${registry.patterns.length} patterns in ${registry.categories.length} categories.\n\n${lines.join('\n')}\n\nNext: search_patterns with a query, or query "${BROWSE_QUERY}" plus a category / tier / maturity filter to list patterns.`;
}

export function searchPatterns(registry: Registry, args: Record<string, unknown>): QueryOutcome {
	const query = boundedString(args.query) ?? '';
	if (query.trim().length === 0) {
		return failure(
			`search_patterns needs a non-empty "query" string of at most ${MAX_ARG_CHARS} characters, e.g. {"query": "background jobs"}, or "${BROWSE_QUERY}" to browse.`,
			'invalid_args',
			[{ tool: 'search_patterns', args: { query: 'background jobs' }, why: 'a well-formed example call.' }],
		);
	}
	// Absent is "no filter"; present-but-unbounded is a client bug, not a wider
	// search — dropping it silently would quietly return MORE than was asked for.
	if (args.category !== undefined && boundedString(args.category) === null) {
		return failure(`"category" must be a string of at most ${MAX_ARG_CHARS} characters.`, 'invalid_args', [
			LIST_EVERYTHING,
		]);
	}
	const category = typeof args.category === 'string' ? args.category.toLowerCase() : null;
	// NOT a no-match: an unrecognised category filter means the query never ran.
	if (category && !registry.patterns.some((pattern) => pattern.category === category)) {
		return failure(noMatchHelp(registry, `category "${category}"`), 'invalid_args', [LIST_EVERYTHING]);
	}
	const { needs } = viewOf(registry);
	const tier = oneOf(args.tier, ['deep', 'light'] as const);
	const maturity = oneOf(args.maturity, ['proven', 'implemented', 'planned'] as const);
	const detail = oneOf(args.detail, SEARCH_DETAILS) ?? 'summary';
	const filtered = Boolean(category || tier || maturity);
	const keep = (pattern: PatternRecord) =>
		(!category || pattern.category === category) &&
		(!tier || pattern.tier === tier) &&
		(!maturity || pattern.maturity === maturity);
	const browsing = query.trim() === BROWSE_QUERY;
	const limit =
		typeof args.limit === 'number'
			? Math.min(Math.max(1, Math.floor(args.limit)), MAX_RESULTS)
			: browsing
				? MAX_RESULTS
				: 5;

	if (browsing) {
		if (!filtered) return ok(categoryMap(registry));
		const members = registry.patterns.filter(keep);
		const rows = members
			.slice(0, limit)
			.map((pattern, index) => searchRow(pattern, index, detail, needs.get(pattern.id) ?? []));
		const more =
			members.length > limit
				? `\n\n${members.length - limit} more — raise limit (max ${MAX_RESULTS}) or narrow the filter.`
				: '';
		return ok(
			`${members.length} pattern(s) match the filter (registry order, deep first within a category):\n\n${rows.join('\n')}${more}`,
		);
	}

	// Scored over the whole registry, filtered after: IDF stays a property of the library, not of the slice.
	const scored = scorePatterns(query, registry.patterns)
		.filter((hit) => keep(hit.pattern))
		.slice(0, limit);
	if (scored.length === 0 || scored[0].strength === 'weak') {
		return noMatch(registry, `"${query}"`, scored, (hit, index) =>
			searchRow(hit.pattern, index, detail === 'ids' ? 'ids' : 'compact', needs.get(hit.pattern.id) ?? [], hit),
		);
	}
	const lines = scored.map((hit, index) => searchRow(hit.pattern, index, detail, needs.get(hit.pattern.id) ?? [], hit));
	return ok(
		`Found ${scored.length} pattern(s) for "${query}":\n\n${lines.join('\n')}\n\nNext: get_pattern with an id (or ids, and sections) for the card.`,
	);
}

/** The not-found answer: a capped id sample (reflecting all of them would be kilobytes) and search. */
function unknownIdsOutcome(registry: Registry, missing: string[]): QueryOutcome {
	const all = registry.patterns;
	const more = all.length > 20 ? `, … (${all.length} total — search_patterns finds the rest)` : '';
	return failure(
		`No pattern with id ${missing.map((id) => `"${id}"`).join(', ')}. Valid ids: ${all
			.slice(0, 20)
			.map((entry) => entry.id)
			.join(', ')}${more}.`,
		'not_found',
		[
			{ tool: 'get_pattern', args: { id: all[0].id }, why: 'a valid id from the list above.' },
			{ tool: 'search_patterns', args: { query: 'background jobs' }, why: 'find the right id by capability.' },
		],
	);
}

export function getPattern(registry: Registry, args: Record<string, unknown>): QueryOutcome {
	// Bounded before use: the not-found branch echoes ids back into the error text and into the
	// telemetry row, so an unbounded id is a reflection channel.
	const requested = Array.isArray(args.ids) ? args.ids : args.id === undefined ? [] : [args.id];
	const ids = requested.map((value) => boundedString(value));
	if (
		(args.id !== undefined && args.ids !== undefined) ||
		ids.length === 0 ||
		ids.length > MAX_CARDS ||
		ids.some((id) => id === null)
	) {
		return failure(
			`get_pattern needs "id" (a string) or "ids" (1-${MAX_CARDS} strings), not both, each at most ${MAX_ARG_CHARS} characters.`,
			'invalid_args',
			[{ tool: 'get_pattern', args: { id: registry.patterns[0].id }, why: 'a well-formed example call.' }],
		);
	}
	const unknownSection =
		args.sections !== undefined &&
		(!Array.isArray(args.sections) ||
			args.sections.length === 0 ||
			args.sections.some((section) => oneOf(section, CARD_SECTIONS) === undefined));
	if (unknownSection) {
		return failure(`"sections" must be a non-empty array of: ${CARD_SECTIONS.join(', ')}.`, 'invalid_args', [
			{
				tool: 'get_pattern',
				args: { id: registry.patterns[0].id, sections: ['invariants'] },
				why: 'a well-formed example call.',
			},
		]);
	}
	// Card order, not request order: a reader expects the same card shape whatever order was asked.
	const picked: unknown[] | null = Array.isArray(args.sections) ? args.sections : null;
	const sections = picked ? CARD_SECTIONS.filter((section) => picked.includes(section)) : CARD_SECTIONS;
	const { byId, graph, needs } = viewOf(registry);
	const patterns = (ids as string[]).map((id) => byId.get(id));
	const missing = (ids as string[]).filter((_, index) => patterns[index] === undefined);
	// A real-shaped id we do not have is a REGISTRY GAP, not a malformed request.
	if (missing.length > 0) return unknownIdsOutcome(registry, missing);
	const shownWithInvariants = new Set(sections.includes('invariants') ? (ids as string[]) : []);
	// Several long cards could pass a client's large-output warning together. A card that would
	// cross the budget is shown as its header and says what it withholds — never cut mid-card.
	const cards: string[] = [];
	let size = 0;
	for (const pattern of patterns as PatternRecord[]) {
		const full = patternCard(pattern, needs.get(pattern.id) ?? [], graph, sections, shownWithInvariants);
		const card =
			cards.length > 0 && size + full.length > CARDS_BUDGET_CHARS
				? `${cardHeader(pattern, needs.get(pattern.id) ?? [], graph)}\n\n_Withheld for size (this response is near the ${CARDS_BUDGET_CHARS / 4 / 1000}k-token budget): ${sections
						.map((section) => ({ section, count: sectionSize(pattern, section) }))
						.filter(({ count }) => count > 0)
						.map(({ section, count }) => `${section} (${count})`)
						.join(
							', ',
						)} — the invariants MUST hold when emulating. Request this card alone: get_pattern {"id":"${pattern.id}"}._`
				: full;
		cards.push(card);
		size += card.length;
	}
	return ok(cards.join('\n\n---\n\n'));
}

export function traceCapability(registry: Registry, args: Record<string, unknown>): QueryOutcome {
	const capability = boundedString(args.capability) ?? '';
	if (capability.trim().length === 0) {
		return failure(
			`trace_capability needs a non-empty "capability" string of at most ${MAX_ARG_CHARS} characters, e.g. {"capability": "approval gate"}.`,
			'invalid_args',
			[{ tool: 'trace_capability', args: { capability: 'approval gate' }, why: 'a well-formed example call.' }],
		);
	}
	const all = scorePatterns(capability, registry.patterns);
	// A trace costs ~500 tokens per pattern, so weak overlaps are never traced.
	const strong = new Set(all.filter((hit) => hit.strength !== 'weak').map((hit) => hit.pattern.id));
	// Ownership is not relevance: a record that names or declares the capability owns it; one that
	// only mentions it in a keyword or its description is context. Owners are traced first.
	const candidates = discover(registry, capability, 10).filter((candidate) => strong.has(candidate.id));
	const owns = (candidate: Candidate) =>
		candidate.complete && (candidate.evidence === 'name' || candidate.evidence === 'capability');
	const scored = [...candidates.filter(owns), ...candidates.filter((candidate) => !owns(candidate))].slice(0, 3);
	if (scored.length === 0) return noMatch(registry, `capability "${capability}"`, all);
	const { byId } = viewOf(registry);
	const sections = scored.map((candidate) => {
		const pattern = byId.get(candidate.id) as PatternRecord;
		return [
			`## ${pattern.title} (\`${pattern.id}\`)`,
			owns(candidate)
				? `**Owns it:** ${candidate.evidence === 'name' ? 'its name is the capability' : `declares the capability "${candidate.matched[0]}"`}.`
				: `**Relevant, does not own it:** matches only ${candidate.evidence === 'keyword' ? `its keyword "${candidate.matched[0]}"` : candidate.evidence === 'text' ? 'its description' : `part of its ${candidate.evidence} ("${candidate.matched[0]}")`}.`,
			`**Concept:** ${pattern.summary} ${pattern.when_to_use}`,
			`**Docs:**\n${refLines(pattern.docs)}`,
			`**Code:**\n${refLines(pattern.code)}`,
			`**Tests:**\n${refLines(pattern.tests)}`,
			`**Proof:**\n${refLines(pattern.showcases)}`,
			pattern.invariants.length > 0
				? `**Invariants:**\n${pattern.invariants.map((rule) => `- ${rule}`).join('\n')}`
				: '',
		]
			.filter((line) => line.length > 0)
			.join('\n');
	});
	return ok(
		`Trace for "${capability}" (${scored.length} matching pattern(s), owners first; concept → docs → code → tests → proof):\n\n${sections.join('\n\n')}`,
	);
}

/** `"x"` → a selection's line in the Requested section. */
function selectionLine(selection: Selection): string {
	if (selection.status === 'selected') {
		const { chosen } = selection;
		return `"${selection.request}" → \`${chosen.id}\` (${chosen.kind}, ${chosen.tier}): ${selection.reason}.`;
	}
	if (selection.status === 'ambiguous') {
		return `"${selection.request}" → **ambiguous**, nothing adopted for it: ${selection.reason}. Candidates: ${selection.candidates.map((candidate) => `\`${candidate.id}\` (${candidate.evidence}${candidate.matched.length > 0 ? `: ${candidate.matched.slice(0, 2).join(', ')}` : ''})`).join(', ')}. Recover: call again with "ids" naming the one you mean.`;
	}
	return `"${selection.request}" → **unmatched**: ${selection.reason}${selection.closest ? ` (closest weak overlap: \`${selection.closest.id}\`)` : ''}. Cover it manually, or search with other terms.`;
}

/** Why a step is in the plan, every reason kept, the causes first and context after. */
function reasonText(step: PlanStep): string {
	const parts = step.reasons.map((reason) => {
		const via =
			'inheritedFrom' in reason && reason.inheritedFrom ? ` (inherited from \`${reason.inheritedFrom}\`)` : '';
		switch (reason.kind) {
			case 'requested':
				return step.requestedAs.length > 0
					? `requested (${step.requestedAs.map((as) => (as === 'id' ? 'by id' : `"${as}"`)).join(', ')})`
					: 'requested';
			case 'builds_on':
				return `\`${reason.from}\` builds on it${via}`;
			case 'part_of':
				return reason.binding === 'required'
					? `required part of \`${reason.from}\`${via}`
					: reason.binding === 'condition'
						? `conditional part of \`${reason.from}\`${via}, required because \`${reason.condition?.id}\` is satisfied (${reason.condition?.when})`
						: `${reason.level} part of \`${reason.from}\`${via}, selected by the caller`;
			default:
				return `also a${reason.level === 'optional' ? 'n optional' : ' conditional'} part of \`${reason.from}\` (\`${reason.condition.id}\`, ${reason.state})`;
		}
	});
	return parts.join('; ');
}

const NEED_STATUS_TEXT: Record<NeedStatus, string> = {
	provided: 'the target provides it',
	lacking: 'the target LACKS it',
	unknown: 'unknown for the target — check',
	'pin-mismatch': 'the target has the capability but not the pinned technology',
};

/** A need with its pins, conditional pins under their conditions. */
function needText(need: ResolvedNeed, status: NeedStatus | null): string {
	const pins = need.pins.map((pin) =>
		pin.conditional
			? `pinned to ${pin.technology} only when ${pin.conditions.join('; or when ')}`
			: `pinned to ${pin.technology}`,
	);
	const details = [
		need.conflict
			? `pins ${need.conflict.certain ? 'conflict' : 'may conflict'}: ${need.conflict.technologies.join(', ')}`
			: '',
		...(need.conflict ? [] : pins),
		need.level === 'conditional' ? `when ${need.conditions.join('; or when ')}` : '',
		need.level === 'optional' || need.level === 'implementation' ? (need.why ?? '') : '',
		`from ${need.origins.map((origin) => `\`${origin}\``).join(', ')}`,
		status ? NEED_STATUS_TEXT[status] : '',
	].filter((part) => part.length > 0);
	return `${need.need} (${details.join('; ')})`;
}

function planInfrastructure(plan: Plan): string[] {
	const at = (level: (typeof NEED_LEVELS)[number]) => plan.needs.filter((entry) => entry.need.level === level);
	const lines = [
		at('required').length === 0
			? 'Required: none beyond the app runtime.'
			: `Required: ${at('required')
					.map((entry) => needText(entry.need, entry.status))
					.join(', ')}.`,
		at('conditional').length > 0
			? `Conditional (needed only when its condition holds; settle each): ${at('conditional')
					.map((entry) => needText(entry.need, entry.status))
					.join(', ')}.`
			: '',
		at('optional').length > 0
			? `Optional (never blocks): ${at('optional')
					.map((entry) => needText(entry.need, null))
					.join(', ')}.`
			: '',
		at('implementation').length > 0
			? `Implementation-specific (v10r's choice, not needed to emulate): ${at('implementation')
					.map((entry) => needText(entry.need, null))
					.join(', ')}.`
			: '',
	];
	return lines.filter((line) => line.length > 0);
}

/** Open constituents: what the plan does not adopt, and the question that would. */
function openLines(plan: Plan): string[] {
	const line = (entry: Plan['adoption']['open'][number]) =>
		`\`${entry.id}\` — ${entry.proposedBy
			.map(
				(proposal) =>
					`${proposal.level} part of \`${proposal.from}\` when ${proposal.condition.when} (\`${proposal.condition.id}\`: ${proposal.state === 'unknown' ? 'unknown' : proposal.state}${proposal.level === 'optional' && proposal.state === 'satisfied' ? ', applies but not selected' : ''})`,
			)
			.join('; ')}`;
	const conditional = plan.adoption.open.filter(
		(entry) => entry.level === 'conditional' && entry.proposedBy.some((proposal) => proposal.state !== 'unsatisfied'),
	);
	const optional = plan.adoption.open.filter(
		(entry) => entry.level === 'optional' && entry.proposedBy.some((proposal) => proposal.state !== 'unsatisfied'),
	);
	const omitted = plan.adoption.open.filter((entry) =>
		entry.proposedBy.every((proposal) => proposal.state === 'unsatisfied'),
	);
	return [
		conditional.length > 0
			? `**Open decisions** (conditional constituents — required when the condition holds; settle with "conditions", or adopt with "select"):\n${bullets(conditional.map(line))}`
			: '',
		optional.length > 0
			? `**Optional** (enhancements, adopted only when selected — a satisfied condition alone does not adopt one):\n${bullets(optional.map(line))}`
			: '',
		omitted.length > 0 ? `**Omitted** (every condition unsatisfied):\n${bullets(omitted.map(line))}` : '',
	].filter((part) => part.length > 0);
}

function renderStep(step: PlanStep, index: number, graph: PatternGraph, full: boolean): string {
	const pattern = graph.byId.get(step.id) as PatternRecord;
	const verb = step.action === 'perform' ? 'Perform (a workflow, run against the project)' : 'Implement';
	const lines = [
		`### ${index + 1}. ${verb}: ${pattern.title} (\`${step.id}\`)${pattern.tier === 'light' ? ' — light record' : ''}`,
		`Why: ${reasonText(step)}.`,
		step.generalizations.length > 0
			? `Specializes ${step.generalizations.map((id) => `\`${id}\``).join(' → ')}: its invariants hold here; it is not built separately.`
			: '',
		step.blockedBy.length > 0
			? `**Blocked:** needs ${step.blockedBy.map((need) => needText(need, 'lacking')).join(', ')}.${step.affects.length > 0 ? ` Affects what stands on it: ${step.affects.map((id) => `\`${id}\``).join(', ')}.` : ''} Provide the need, replace this step, or drop it with what stands on it.`
			: '',
		step.needs.length > 0 ? `Needs: ${needsSummary(step.needs, { condition: true })}` : '',
	];
	if (full) {
		lines.push(
			`Risk: ${pattern.risk}`,
			...fitnessLines(pattern),
			`Read:\n${refLines(pattern.docs)}`,
			pattern.code.length > 0 ? `Model on:\n${refLines(pattern.code)}` : '',
			pattern.tests.length > 0 ? `Mirror tests:\n${refLines(pattern.tests)}` : '',
		);
		const invariants = [bullets(pattern.invariants), inheritedInvariantLines(pattern, graph)].filter(
			(part) => part.length > 0,
		);
		lines.push(
			invariants.length > 0
				? `Invariants (must hold):\n${invariants.join('\n')}`
				: pattern.tier === 'light'
					? 'Light record: no curated invariants — its docs are the canonical explanation.'
					: '',
		);
	} else if (pattern.avoid_when.length > 0) {
		lines.push(
			`Avoid when: ${pattern.avoid_when[0]}${pattern.avoid_when.length > 1 ? ` (+${pattern.avoid_when.length - 1} more)` : ''}`,
		);
	}
	return lines.filter((line) => line.length > 0).join('\n');
}

/** Strings from an array argument, bounded; null when the argument is malformed. */
function stringList(value: unknown, max: number): string[] | null {
	if (value === undefined) return [];
	if (!Array.isArray(value) || value.length > max) return null;
	const items = value.map((item) => boundedString(item));
	return items.some((item) => item === null || item.trim().length === 0) ? null : (items as string[]);
}

const PLAN_EXAMPLE: NextAction = {
	tool: 'recommend_emulation_plan',
	args: { capabilities: ['grounded answers'], ids: ['graph-rag'] },
	why: 'a well-formed example call.',
};

export function recommendPlan(registry: Registry, args: Record<string, unknown>): QueryOutcome {
	const capabilities = stringList(args.capabilities, MAX_CAPABILITIES);
	// Ids are a set: the plan is the same whatever order they are given in.
	const listed = stringList(args.ids, MAX_CAPABILITIES);
	const ids = listed === null ? null : [...new Set(listed)].sort();
	const select = stringList(args.select, MAX_CAPABILITIES);
	const exclude = stringList(args.exclude, MAX_CAPABILITIES);
	const existing = stringList(args.target_has, MAX_RESULTS);
	const lacks = stringList(args.target_lacks, TARGET_INFRA_WORDS.length);
	if ([capabilities, ids, select, exclude, existing, lacks].some((list) => list === null)) {
		return failure(
			`recommend_emulation_plan takes "capabilities" and/or "ids" (each 1-${MAX_CAPABILITIES} non-empty strings of at most ${MAX_ARG_CHARS} characters); "select", "exclude" and "target_has" are id arrays. Split a larger request; nothing is truncated.`,
			'invalid_args',
			[PLAN_EXAMPLE],
		);
	}
	if ((capabilities as string[]).length + (ids as string[]).length === 0) {
		return failure(
			'recommend_emulation_plan needs "capabilities" (what you want) or "ids" (canonical record ids), or both.',
			'invalid_args',
			[PLAN_EXAMPLE],
		);
	}
	if ((lacks as string[]).some((word) => !TARGET_INFRA_WORDS.includes(word))) {
		return failure(`"target_lacks" must be an array of: ${TARGET_INFRA_WORDS.join(', ')}.`, 'invalid_args', [
			PLAN_EXAMPLE,
		]);
	}
	const conditions = new Map<string, 'satisfied' | 'unsatisfied'>();
	if (args.conditions !== undefined) {
		const entries = Array.isArray(args.conditions) ? args.conditions : null;
		const valid =
			entries !== null &&
			entries.length <= MAX_RESULTS &&
			entries.every(
				(entry) =>
					typeof entry === 'object' &&
					entry !== null &&
					boundedString((entry as Record<string, unknown>).id) !== null &&
					['satisfied', 'unsatisfied'].includes((entry as Record<string, unknown>).state as string),
			);
		if (!valid) {
			return failure(
				'"conditions" must be an array of {"id": "<condition id from a plan>", "state": "satisfied" | "unsatisfied"}; leave a condition out when it is unknown.',
				'invalid_args',
				[PLAN_EXAMPLE],
			);
		}
		for (const entry of entries as { id: string; state: 'satisfied' | 'unsatisfied' }[])
			conditions.set(entry.id, entry.state);
	}
	const parsedTarget = targetOf(args);
	if (!('target' in parsedTarget)) return parsedTarget;
	const detail = oneOf(args.detail, PLAN_DETAILS) ?? 'compact';
	const { byId, graph } = viewOf(registry);

	// Ids are validated, never resolved: an unknown or retired id is reported, not aliased.
	const unknownIds = (ids as string[]).filter((id) => !byId.has(id));
	const selections = (capabilities as string[]).map((capability) => selectRecord(registry, capability));
	const roots = new Map<string, string[]>();
	for (const id of ids as string[]) if (byId.has(id)) roots.set(id, [...(roots.get(id) ?? []), 'id']);
	for (const selection of selections) {
		if (selection.status !== 'selected') continue;
		const id = selection.chosen.id;
		roots.set(id, [...(roots.get(id) ?? []), selection.request]);
	}
	if (roots.size === 0) {
		if (unknownIds.length > 0 && selections.length === 0) return unknownIdsOutcome(registry, unknownIds);
		const ambiguous = selections.filter((selection) => selection.status === 'ambiguous');
		if (ambiguous.length === 0) {
			const closest = selections.flatMap((selection) =>
				selection.status === 'unmatched' && selection.closest ? [selection.closest.id] : [],
			);
			return failure(
				[
					`No record matches ${selections.map((selection) => `"${selection.request}"`).join(', ')}.`,
					...selections.map(selectionLine),
					...(unknownIds.length > 0 ? [`Unknown ids: ${unknownIds.join(', ')}.`] : []),
				].join('\n'),
				'empty',
				[
					...(closest[0]
						? [
								{
									tool: 'get_pattern',
									args: { id: closest[0] },
									why: 'the closest candidate — confirm it or rule it out.',
								},
							]
						: []),
					LIST_EVERYTHING,
				],
			);
		}
	}
	const plan = assemble(registry, {
		roots,
		conditions,
		selected: new Set(select as string[]),
		excluded: new Set(exclude as string[]),
		target: {
			provides: parsedTarget.target,
			lacks: new Set(lacks as string[]),
			existing: new Set(existing as string[]),
		},
	});
	const requested = [
		...(ids as string[]).map((id) =>
			byId.has(id)
				? `\`${id}\` by id (${byId.get(id)?.kind})${byId.get(id)?.kind === 'principle' ? ' — a principle: it constrains the work below, never a step' : ''}`
				: `\`${id}\` — **unknown id**: no record has it (retired and renamed ids are not resolved; find the current one with search_patterns).`,
		),
		...selections.map(selectionLine),
	];
	const satisfied = plan.adoption.satisfied.map((id) => `\`${id}\` (${reasonTextOf(plan, id)})`);
	const conflicts = [
		...plan.adoption.excluded
			.filter((entry) => entry.conflict)
			.map(
				(entry) =>
					`\`${entry.id}\` is excluded but ${reasonTextOf(plan, entry.id)} — the plan cannot hold both; resolve it before building.`,
			),
		...plan.needs
			.filter((entry) => entry.need.conflict)
			.map(
				(entry) =>
					`${entry.need.need}: pins ${entry.need.conflict?.certain ? 'conflict' : 'may conflict'} (${entry.need.conflict?.technologies.join(', ')}) from ${entry.need.origins.join(', ')}.`,
			),
	];
	const declined = plan.adoption.excluded.filter((entry) => !entry.conflict).map((entry) => `\`${entry.id}\``);
	// A need condition is moot once the need is required anyway; the rest stay visible.
	const requiredNeeds = new Set(
		plan.needs.filter((entry) => entry.need.level === 'required').map((entry) => entry.need.need),
	);
	const unresolved = plan.unresolved.filter(
		(condition) => condition.origin.kind === 'need' && !requiredNeeds.has(condition.origin.need),
	);
	const reported = [
		...plan.unknownIds.map((id) => `"select"/"exclude"/"target_has" id \`${id}\` is not a record.`),
		...plan.irrelevantConditions.map((id) => `Condition \`${id}\` is not met by this plan (ignored).`),
	];
	const render = (full: boolean) => plan.steps.map((step, index) => renderStep(step, index, graph, full));
	let steps = render(detail === 'full');
	const fullSize = steps.join('\n\n').length;
	const overBudget = detail === 'full' && fullSize > PLAN_BUDGET_CHARS;
	if (overBudget) steps = render(false);
	const implement = plan.steps.filter((step) => step.action === 'implement').length;
	const perform = plan.steps.length - implement;
	const sections = [
		`# Emulation plan: ${implement} to implement${perform > 0 ? `, ${perform} to perform` : ''}${plan.adoption.satisfied.length > 0 ? `, ${plan.adoption.satisfied.length} already satisfied` : ''}${plan.blocked.length > 0 ? `, ${plan.blocked.length} blocked` : ''}`,
		'Assembled deterministically from the registry: selection is explained per request, and assembly never reinterprets it. Adapt each pattern to the target; emulate, do not clone.',
		`## Requested\n${bullets(requested)}`,
		plan.steps.length > 0
			? `## Steps (foundations and constituents first)\n\n${steps.join('\n\n')}`
			: '## Steps\nNone: nothing selected adopts a buildable record.',
		satisfied.length > 0 ? `## Already satisfied by the target (not built again)\n${bullets(satisfied)}` : '',
		conflicts.length > 0 ? `## Conflicts\n${bullets(conflicts)}` : '',
		plan.blocked.length > 0
			? `## Blocked\n${bullets(plan.blocked.map((step) => `\`${step.id}\` needs ${step.blockedBy.map((need) => need.need).join(', ')}, which the target lacks${step.affects.length > 0 ? `; affects ${step.affects.map((id) => `\`${id}\``).join(', ')}` : ''}.`))}`
			: '',
		...openLines(plan),
		declined.length > 0 ? `**Excluded by the caller** (nothing requires them): ${declined.join(', ')}.` : '',
		plan.requestedPrinciples.length + plan.principles.length > 0
			? `## Principles (constrain the work; never steps)\n${bullets([
					...plan.requestedPrinciples.map((id) => `\`${id}\` — requested: review every step against it`),
					...plan.principles.map(
						(entry) => `\`${entry.id}\` — applies to ${entry.steps.map((id) => `\`${id}\``).join(', ')}: ${entry.why}`,
					),
				])}`
			: '',
		plan.conventions.length > 0
			? `## Assumes (platform conventions; build one only if the target lacks it)\n${bullets(plan.conventions.map((entry) => `\`${entry.id}\` for ${entry.steps.map((id) => `\`${id}\``).join(', ')}: ${entry.why}`))}`
			: '',
		`## Infrastructure${parsedTarget.target === null && (lacks as string[]).length === 0 ? ' (target not described: every need is unknown for it)' : ''}\n${bullets(planInfrastructure(plan))}`,
		unresolved.length > 0
			? `## Unresolved conditions on needs\n${bullets(unresolved.map((condition) => `\`${condition.id}\`: ${condition.when}`))}`
			: '',
		reported.length > 0 ? `## Reported\n${bullets(reported)}` : '',
		plan.adoption.cyclic ? 'Warning: adoption cycle detected; order is best-effort.' : '',
		overBudget
			? `_Compact: full detail would be ≈${Math.round(fullSize / 4 / 1000)}k tokens, past the 10k a client warns at. Nothing decision-critical is withheld; read each step's invariants and code with get_pattern (ids, ≤ ${MAX_CARDS} per call)._`
			: detail === 'compact'
				? `_Compact: per-step invariants, docs, code and tests are withheld — detail "full", or get_pattern with ids (≤ ${MAX_CARDS} per call) and sections ["invariants", "code"]._`
				: '',
	];
	return ok(sections.filter((section) => section.length > 0).join('\n\n'));
}

/** The reasons of a reached record that is not a step (satisfied or excluded), as text. */
function reasonTextOf(plan: Plan, id: string): string {
	return reasonText({
		id,
		kind: 'pattern',
		tier: 'deep',
		action: 'implement',
		requestedAs: plan.roots.find((root) => root.id === id)?.requestedAs ?? [],
		reasons: plan.adoption.reasons.get(id) ?? [],
		generalizations: [],
		needs: [],
		blockedBy: [],
		affects: [],
	});
}

/** The four registry tools and the two Architecture Engineering tools by name — each
 *  transport's dispatcher looks a call up here first. */
export const REGISTRY_QUERIES: Record<string, (registry: Registry, args: Record<string, unknown>) => QueryOutcome> = {
	search_patterns: searchPatterns,
	get_pattern: getPattern,
	trace_capability: traceCapability,
	recommend_emulation_plan: recommendPlan,
	// The text answer; the hosted MCP App adds its View and the same projection as structured content.
	explore_patterns: (registry, args) => explorePatterns(registry, args),
	...ARCHITECTURE_QUERIES,
};
