/**
 * The registry query layer: the tool contract and the four registry tools of the Pattern MCP
 * (search_patterns, get_pattern, trace_capability, recommend_emulation_plan), written ONCE.
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

import { DEFAULT_LINES, type ExcerptRequest, MAX_LINES } from './excerpt.ts';
import type { PatternRecord, PatternRequirement, Registry, RegRef } from './schema.ts';
import { buildById, PATTERN_REQUIREMENTS, topoSort } from './schema.ts';
import { type Scored, scorePatterns } from './search.ts';

/** MCP tools/list shape — name/description/inputSchema ONLY: `outputSchema`, `title` or
 *  `annotations` on any one tool made Claude Code silently drop the server's whole tool list. */
export interface ToolDef {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
}

/**
 * A concrete next step handed to the caller on every error (the "self-reflective API" pattern:
 * agents recover measurably better from a named next call than from prose alone).
 *
 * `args` values are ALWAYS literals this module wrote — never caller text. The bounded-echo
 * discipline (get_pattern's id reflection) is the ceiling; this block adds no echo surface.
 */
export interface NextAction {
	tool: string;
	args?: Record<string, string | number | boolean | readonly string[]>;
	why: string;
}

export const NEXT_ACTIONS_HEADING = '## Next actions';
export const MAX_NEXT_ACTIONS = 3;

/**
 * Renders the trailer as TEXT inside the body — not a structured field: results are text-only
 * by hard-won convention (structuredContent makes Claude Code hide the text body), and a fixed
 * heading is exactly as machine-parsable while staying visible. Never throws; an empty array
 * returns the body unchanged.
 */
export function withNextActions(body: string, actions: readonly NextAction[]): string {
	if (actions.length === 0) return body;
	const lines = actions.slice(0, MAX_NEXT_ACTIONS).map((action, index) => {
		const args = action.args ? ` ${JSON.stringify(action.args)}` : '';
		return `${index + 1}. \`${action.tool}\`${args} — ${action.why}`;
	});
	return `${body}\n\n${NEXT_ACTIONS_HEADING}\n${lines.join('\n')}`;
}

/** Why a query failed. A subset of the hosted `ToolDiag`, which carries it into telemetry. */
export type QueryDiag = 'empty' | 'invalid_args' | 'not_found';

export type QueryOutcome =
	| { ok: true; text: string }
	| { ok: false; text: string; diag: QueryDiag; next: readonly NextAction[] };

/**
 * Argument bounds. They appear in `inputSchema` so the contract is honest, but nothing in either
 * transport validates against the schema — the enforcement is in the handlers, and the schema
 * entries exist so a well-behaved client self-limits rather than discovering the bound as an error.
 *
 * `MAX_CAPABILITIES` is load-bearing rather than tidy: `recommendPlan` scores the registry once
 * per entry, so an unbounded array is a CPU amplifier reachable without credentials on the
 * hosted endpoint. 256 KB of one-character strings is still tens of thousands of entries.
 */
export const MAX_ARG_CHARS = 512;
export const MAX_CAPABILITIES = 20;
/** Search hits per call. 50 covers any one category; `detail: "ids"` keeps that around 1k tokens. */
const MAX_RESULTS = 50;
/** Cards per get_pattern call: a deep card is ~850 tokens, so five stay under Claude Code's 10k warning. */
const MAX_CARDS = 5;

/**
 * What the TARGET project already runs, from the closed `PATTERN_REQUIREMENTS` vocabulary. Absent
 * means unknown — rows then state requirements without a verdict; present, every row and step
 * says whether the target has what the pattern needs, its dependencies' needs included.
 */
const TARGET_INFRA_SCHEMA = {
	type: 'array',
	items: { type: 'string', enum: PATTERN_REQUIREMENTS },
	description: 'What the target project HAS, e.g. ["postgres"] ([] = none); each result then says whether it fits.',
};

const PLAN_DETAILS = ['outline', 'full'] as const;
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
			'Assemble a dependency-ordered emulation plan for desired capabilities — deterministic registry assembly, no inference: matching patterns plus prerequisites, topologically ordered, each step with its contraindications, required infrastructure and the invariants to preserve. Drop any step whose "Avoid when" describes the target.',
		inputSchema: {
			type: 'object',
			additionalProperties: false,
			properties: {
				capabilities: {
					type: 'array',
					items: { type: 'string', maxLength: MAX_ARG_CHARS },
					minItems: 1,
					maxItems: MAX_CAPABILITIES,
					description: `Capabilities the target project needs (1-${MAX_CAPABILITIES}) — e.g. ["layered RAG", "background jobs", "design system"].`,
				},
				include_dependencies: {
					type: 'boolean',
					default: true,
					description: 'Expand the plan with prerequisite patterns via depends_on. Default true.',
				},
				target_infra: TARGET_INFRA_SCHEMA,
				detail: {
					type: 'string',
					enum: PLAN_DETAILS,
					default: 'full',
					description: 'full (default) = docs, code, tests, invariants per step; outline = steps and fitness only.',
				},
			},
			required: ['capabilities'],
		},
	},
];

/**
 * How to use the six tools, for the `initialize` instructions of BOTH transports — each wraps it
 * in its own framing. Claude Code loads server instructions upfront (cut at 4,096 characters),
 * so this is the one place the progressive path is taught before any tool is called.
 */
export const QUERY_WORKFLOW =
	'Discover broadly, then narrow: search_patterns (query "*" maps the categories; detail "compact" adds each ' +
	"pattern's requirements and headline contraindication; a weak-only result means no pattern covers it) or " +
	'trace_capability; get_pattern for cards (ids for several, sections for part of one — invariants MUST hold when ' +
	'emulating); get_file_excerpt for exact evidence (section = one heading or declaration; card paths with ' +
	'#fragments resolve); recommend_emulation_plan for a dependency-ordered plan (target_infra marks steps the ' +
	'target cannot support); validate_snippet to check code you wrote against v10r conventions (loop until clean).';

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

/** A requirement and, when it is inherited, the dependency it comes from. */
interface Need {
	need: PatternRequirement;
	via?: string;
}

/** Per-registry derived lookups, computed once per registry object rather than per call. */
interface RegistryView {
	byId: Map<string, PatternRecord>;
	order: string[];
	/** Own requirements plus every dependency's, transitively — what adopting the pattern really takes. */
	needs: Map<string, Need[]>;
}

function needsOf(pattern: PatternRecord, byId: Map<string, PatternRecord>): Need[] {
	const needs: Need[] = pattern.requires.map((need) => ({ need }));
	const seen = new Set([pattern.id]);
	const queue = [...pattern.depends_on];
	while (queue.length > 0) {
		const id = queue.shift();
		if (id === undefined || seen.has(id)) continue;
		seen.add(id);
		const dep = byId.get(id);
		if (!dep) continue;
		for (const need of dep.requires) if (!needs.some((known) => known.need === need)) needs.push({ need, via: id });
		queue.push(...dep.depends_on);
	}
	return needs;
}

const views = new WeakMap<Registry, RegistryView>();

function viewOf(registry: Registry): RegistryView {
	let view = views.get(registry);
	if (!view) {
		const byId = buildById(registry);
		view = {
			byId,
			order: registry.patterns.map((pattern) => pattern.id),
			needs: new Map(registry.patterns.map((pattern) => [pattern.id, needsOf(pattern, byId)])),
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

const needsText = (needs: Need[]) => needs.map(({ need, via }) => (via ? `${need} (via ${via})` : need)).join(', ');

/** Parse `target_infra`: absent → unknown (`null`); otherwise only vocabulary words are accepted. */
function targetOf(args: Record<string, unknown>): { ok: true; target: ReadonlySet<string> | null } | QueryOutcome {
	if (args.target_infra === undefined) return { ok: true, target: null };
	const values = Array.isArray(args.target_infra) ? args.target_infra : null;
	if (values === null || values.some((value) => !(PATTERN_REQUIREMENTS as readonly unknown[]).includes(value))) {
		return failure(`"target_infra" must be an array of: ${PATTERN_REQUIREMENTS.join(', ')}.`, 'invalid_args', [
			{
				tool: 'recommend_emulation_plan',
				args: { capabilities: ['background jobs'], target_infra: ['postgres'] },
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

/** The always-shown part of a card: identity, evidence grade, risk and what it stands on. */
function cardHeader(pattern: PatternRecord, needs: Need[]): string {
	const facts = [
		`**Category:** ${pattern.category} · **Tier:** ${pattern.tier} · **Maturity:** ${pattern.maturity}${pattern.verifiedAt ? ` (verified ${pattern.verifiedAt})` : ''} · **Risk:** ${pattern.risk}`,
		pattern.depends_on.length > 0 ? `**Depends on:** ${pattern.depends_on.join(', ')}` : '',
		needs.length > 0 ? `**Requires:** ${needsText(needs)}` : '',
	].filter((line) => line.length > 0);
	return `# ${pattern.title} (\`${pattern.id}\`)\n\n${facts.join('\n')}`;
}

/**
 * One card section's text, or '' when the record has nothing for it. Light records are index
 * rows: they carry no invariants or emulation notes by contract, so those render as nothing
 * rather than as empty headings.
 */
function cardSection(pattern: PatternRecord, section: CardSection): string {
	const light = pattern.tier === 'light';
	switch (section) {
		case 'overview':
			return `${pattern.summary}\n\n**When to use:** ${pattern.when_to_use}`;
		case 'fitness':
			// `requires` lives in the header, so a card filtered to one section never hides it.
			return fitnessLines(pattern).join('\n');
		case 'docs':
			return `## Docs to read\n${refLines(pattern.docs)}`;
		case 'code':
			return light && pattern.code.length === 0 ? '' : `## Code entry points\n${refLines(pattern.code)}`;
		case 'tests':
			return light && pattern.tests.length === 0 ? '' : `## Tests that pin it\n${refLines(pattern.tests)}`;
		case 'showcases':
			return light && pattern.showcases.length === 0 ? '' : `## Showcase proof\n${refLines(pattern.showcases)}`;
		case 'invariants':
			return pattern.invariants.length > 0
				? `## Invariants (must hold when emulating)\n${bullets(pattern.invariants)}`
				: '';
		case 'emulation_notes':
			return pattern.emulation_notes.length > 0 ? `## Emulation notes\n${bullets(pattern.emulation_notes)}` : '';
	}
}

/**
 * A card, whole or in part. What a partial card leaves out is NAMED in a closing line, with
 * counts — selective disclosure must never read as "this pattern has no invariants".
 */
function patternCard(pattern: PatternRecord, needs: Need[], sections: readonly CardSection[] = CARD_SECTIONS): string {
	const shown = sections.map((section) => cardSection(pattern, section)).filter((text) => text.length > 0);
	const withheld = CARD_SECTIONS.filter((section) => !sections.includes(section))
		.map((section) => ({ section, size: sectionSize(pattern, section) }))
		.filter(({ size }) => size > 0);
	const footer =
		withheld.length > 0
			? `_Not shown: ${withheld.map(({ section, size }) => `${section} (${size})`).join(', ')}${withheld.some(({ section }) => section === 'invariants') ? ' — the invariants MUST hold when emulating; read them before writing code' : ''}. Request them with sections._`
			: pattern.tier === 'light'
				? '_Index record — the docs above are the canonical explanation; deep-tier cards carry invariants and emulation notes._'
				: '';
	return [cardHeader(pattern, needs), ...shown, footer].filter((part) => part.length > 0).join('\n\n');
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
function searchRow(pattern: PatternRecord, index: number, detail: SearchDetail, needs: Need[], hit?: Scored): string {
	const strength = hit ? ` · ${hit.strength}` : '';
	if (detail === 'ids') return `${index + 1}. \`${pattern.id}\` — ${pattern.title}${strength}`;
	const fitness = [
		// Transitive: what adopting it really takes, its dependencies' infrastructure included.
		needs.length > 0 ? `requires ${needsText(needs)}` : '',
		pattern.depends_on.length > 0 ? `depends on ${pattern.depends_on.join(', ')}` : '',
		pattern.avoid_when.length > 0 ? `avoid when: ${pattern.avoid_when[0]}` : '',
	].filter((part) => part.length > 0);
	const lines = [
		`${index + 1}. **${pattern.title}** (\`${pattern.id}\`, ${pattern.category}, ${pattern.tier}, ${pattern.maturity})`,
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
function unknownIds(registry: Registry, missing: string[]): QueryOutcome {
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
	const { byId, needs } = viewOf(registry);
	const patterns = (ids as string[]).map((id) => byId.get(id));
	const missing = (ids as string[]).filter((_, index) => patterns[index] === undefined);
	// A real-shaped id we do not have is a REGISTRY GAP, not a malformed request.
	if (missing.length > 0) return unknownIds(registry, missing);
	return ok(
		(patterns as PatternRecord[])
			.map((pattern) => patternCard(pattern, needs.get(pattern.id) ?? [], sections))
			.join('\n\n---\n\n'),
	);
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
	const scored = all.filter((hit) => hit.strength !== 'weak').slice(0, 3);
	if (scored.length === 0) return noMatch(registry, `capability "${capability}"`, all);
	const sections = scored.map((hit) => {
		const pattern = hit.pattern;
		return [
			`## ${pattern.title} (\`${pattern.id}\`)`,
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
		`Trace for "${capability}" (${scored.length} matching pattern(s), concept → docs → code → tests → proof):\n\n${sections.join('\n\n')}`,
	);
}

export function recommendPlan(registry: Registry, args: Record<string, unknown>): QueryOutcome {
	// Refuse rather than truncate — a plan silently built from the first 20 of 5000
	// capabilities looks complete and is not.
	if (Array.isArray(args.capabilities) && args.capabilities.length > MAX_CAPABILITIES) {
		return failure(
			`"capabilities" accepts at most ${MAX_CAPABILITIES} entries; got ${args.capabilities.length}. Split the request.`,
			'invalid_args',
			[
				{
					tool: 'recommend_emulation_plan',
					args: { capabilities: ['layered RAG', 'background jobs'] },
					why: 'retry with the first batch of at most 20 capabilities.',
				},
			],
		);
	}
	const capabilities = Array.isArray(args.capabilities)
		? args.capabilities.filter(
				(item): item is string => typeof item === 'string' && item.trim().length > 0 && item.length <= MAX_ARG_CHARS,
			)
		: [];
	if (capabilities.length === 0) {
		return failure(
			`recommend_emulation_plan needs "capabilities": a non-empty array of 1-${MAX_CAPABILITIES} strings, each at most ${MAX_ARG_CHARS} characters, e.g. ["layered RAG", "background jobs"].`,
			'invalid_args',
			[
				{
					tool: 'recommend_emulation_plan',
					args: { capabilities: ['layered RAG', 'background jobs'] },
					why: 'a well-formed example call.',
				},
			],
		);
	}
	const parsedTarget = targetOf(args);
	if (!('target' in parsedTarget)) return parsedTarget;
	const { target } = parsedTarget;
	const detail = oneOf(args.detail, PLAN_DETAILS) ?? 'full';
	const includeDeps = args.include_dependencies !== false;
	const { byId, order: registryOrder, needs } = viewOf(registry);
	// Plan steps come from DEEP records only — a step without invariants is noise.
	// Capabilities that only match light index rows are reported in a trailer so
	// the gap is visible (and a promotion candidate) instead of silently dropped.
	const satisfies = new Map<string, string[]>();
	const lightOnly: string[] = [];
	const unmatched: string[] = [];
	for (const capability of capabilities) {
		// A weak overlap never becomes a plan step: the capability is reported unmatched instead.
		const all = scorePatterns(capability, registry.patterns);
		const ranked = all.filter((hit) => hit.strength !== 'weak');
		const deep = ranked.filter((hit) => hit.pattern.tier === 'deep');
		// The best deep hit, plus a runner-up only when it is a STRONG match within half the
		// best score: a partial runner-up is an adjacent pattern, and every step drags its own
		// dependencies into the plan.
		const best = deep.filter(
			(hit, index) => index === 0 || (index === 1 && hit.strength === 'strong' && hit.score >= deep[0].score / 2),
		);
		if (best.length === 0) {
			const lightHits = ranked.filter((hit) => hit.pattern.tier === 'light').slice(0, 2);
			if (lightHits.length > 0) {
				lightOnly.push(`"${capability}" → ${lightHits.map((hit) => `\`${hit.pattern.id}\``).join(', ')}`);
			} else {
				// Name the closest weak overlap: on a paraphrase it is often the right card.
				unmatched.push(all[0] ? `${capability} (closest weak overlap: \`${all[0].pattern.id}\`)` : capability);
			}
			continue;
		}
		for (const hit of best) {
			satisfies.set(hit.pattern.id, [...(satisfies.get(hit.pattern.id) ?? []), capability]);
		}
	}
	if (satisfies.size === 0 && lightOnly.length === 0) {
		return noMatch(registry, `capabilities [${capabilities.join(', ')}]`);
	}
	if (satisfies.size === 0) {
		return ok(
			`No deep pattern card matches these capabilities yet, but the index knows them.\n\n## Related index entries (no deep card yet)\n${lightOnly.map((line) => `- ${line}`).join('\n')}\n\nCall get_pattern on an id above for its docs/code pointers.`,
		);
	}
	const selected = new Set(satisfies.keys());
	if (includeDeps) {
		const queue = [...selected];
		while (queue.length > 0) {
			const current = queue.pop();
			if (current === undefined) break;
			for (const dep of byId.get(current)?.depends_on ?? []) {
				if (!selected.has(dep)) {
					selected.add(dep);
					queue.push(dep);
				}
			}
		}
	}
	const { order, cyclic } = topoSort([...selected], byId, registryOrder);
	const renderStep = (id: string, index: number, outlined: boolean) => {
		const pattern = byId.get(id);
		if (!pattern) return `${index + 1}. ${id}`;
		const covers = satisfies.get(id);
		const stepNeeds = needs.get(id) ?? [];
		const lacking = target ? stepNeeds.filter(({ need }) => !target.has(need)) : [];
		const requirement = [
			stepNeeds.length > 0 ? `Requires: ${needsText(stepNeeds)}` : '',
			target === null
				? ''
				: lacking.length > 0
					? `**Target lacks ${needsText(lacking)} — drop or replace this step, and the steps that build on it.**`
					: 'Fits the target.',
		].filter((line) => line.length > 0);
		const head = [
			`### Step ${index + 1}: ${pattern.title} (\`${id}\`)`,
			covers ? `Satisfies: ${covers.join(', ')}` : 'Included as prerequisite (depends_on).',
			`Risk: ${pattern.risk}`,
			...requirement,
		];
		if (outlined) {
			return [
				...head,
				pattern.avoid_when.length > 0 ? `Avoid when: ${pattern.avoid_when[0]}` : '',
				`Not shown: ${pattern.invariants.length} invariant(s) that MUST hold, ${pattern.code.length} code entry point(s), ${pattern.docs.length} doc(s).`,
			]
				.filter((line) => line.length > 0)
				.join('\n');
		}
		return [
			...head,
			...fitnessLines(pattern),
			`Read:\n${refLines(pattern.docs)}`,
			`Model on:\n${refLines(pattern.code)}`,
			pattern.tests.length > 0 ? `Mirror tests:\n${refLines(pattern.tests)}` : '',
			`Invariants:\n${bullets(pattern.invariants)}`,
		]
			.filter((line) => line.length > 0)
			.join('\n');
	};
	let steps = order.map((id, index) => renderStep(id, index, detail === 'outline'));
	// A full plan past the budget would trip a client's large-output warning (Claude Code: 10k
	// tokens). It is outlined instead — and says so — never cut off mid-step.
	const fullSize = steps.join('\n\n').length;
	const overBudget = detail === 'full' && fullSize > PLAN_BUDGET_CHARS;
	if (overBudget) steps = order.map((id, index) => renderStep(id, index, true));
	const outlined = detail === 'outline' || overBudget;
	const planNeeds = [...new Set(order.flatMap((id) => (needs.get(id) ?? []).map(({ need }) => need)))];
	const missing = target ? planNeeds.filter((need) => !target.has(need)) : [];
	const requiresNote =
		planNeeds.length === 0
			? 'This plan requires no infrastructure beyond the app runtime.'
			: target === null
				? `This plan requires: ${planNeeds.join(', ')}. If the target project lacks one, drop or replace the step that needs it.`
				: missing.length === 0
					? `This plan requires: ${planNeeds.join(', ')} — the target has all of it.`
					: `This plan requires: ${planNeeds.join(', ')}. The target lacks ${missing.join(', ')}: the steps marked above need it.`;
	const notes = [
		'Assembled deterministically from the registry — no inference. Adapt each pattern to the target project; emulate, do not clone.',
		requiresNote,
		lightOnly.length > 0 ? `Related index entries (no deep card yet): ${lightOnly.join('; ')}.` : '',
		unmatched.length > 0
			? `Unmatched capabilities (no registry entry yet — cover manually or search with different terms): ${unmatched.join(', ')}.`
			: '',
		cyclic ? 'Warning: dependency cycle detected; order is best-effort.' : '',
		outlined
			? `Next: get_pattern with ids (≤ ${MAX_CARDS} per call) and sections ["invariants", "code"] for the steps you keep.`
			: '',
	].filter((line) => line.length > 0);
	const budgetNote = overBudget
		? ` — outlined: full detail would be ≈${Math.round(fullSize / 4 / 1000)}k tokens, past the 10k a client warns at`
		: '';
	return ok(
		`# Emulation plan (${order.length} pattern(s), dependency-ordered)${budgetNote}\n\n${steps.join('\n\n')}\n\n---\n${notes.map((note) => `- ${note}`).join('\n')}`,
	);
}

/** The four registry tools by name — each transport's dispatcher looks a call up here first. */
export const REGISTRY_QUERIES: Record<string, (registry: Registry, args: Record<string, unknown>) => QueryOutcome> = {
	search_patterns: searchPatterns,
	get_pattern: getPattern,
	trace_capability: traceCapability,
	recommend_emulation_plan: recommendPlan,
};
