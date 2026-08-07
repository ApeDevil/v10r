/**
 * The PUBLIC read-only tool registry: the six Pattern tools, exposed by `/api/mcp/public`.
 * Structurally read-only — there is no mutation tool here to dispatch. Handlers are pure
 * functions over the statically-imported registry, except get_file_excerpt which reads
 * allowlisted files through the hosted-safe reader and validate_snippet which runs the
 * shared rule engine over caller-supplied text.
 */
import { renderReport, validateSnippet } from '../snippet/engine';
import { MAX_SNIPPET_CHARS } from '../snippet/rules';
import { errorResult, type NextAction, type ToolDef, type ToolRegistry, type ToolResult, textResult } from '../types';
import { buildById, DEEP_PATTERNS, PATTERNS, type PatternRecord, REGISTRY_ORDER, type RegRef } from './data';
import { DEFAULT_LINES, MAX_LINES, readAllowlistedExcerpt } from './excerpts';
import { scorePatterns, topoSort } from './search';

/**
 * Argument bounds for the PUBLIC, unauthenticated registry.
 *
 * These appear in `inputSchema` so the contract is honest, but the schema is
 * advertised — nothing in the transport validates against it, and every handler
 * below does its own permissive coercion. The enforcement that matters is
 * therefore in the handlers, and the schema entries exist so a well-behaved
 * client self-limits rather than discovering the bound as an error.
 *
 * `MAX_CAPABILITIES` is the one that is load-bearing rather than tidy:
 * `recommendPlan` runs `scorePatterns` over the whole registry once per entry,
 * so an unbounded array is a CPU amplifier reachable without credentials. The
 * body budget does not cover it — 256 KB of one-character strings is still tens
 * of thousands of entries.
 */
const MAX_ARG_CHARS = 512;
const MAX_CAPABILITIES = 20;

/** Reject rather than truncate: a silently shortened query returns confidently wrong results. */
function boundedString(value: unknown, max = MAX_ARG_CHARS): string | null {
	if (typeof value !== 'string') return null;
	return value.length > max ? null : value;
}

export const PATTERN_TOOLS: ToolDef[] = [
	{
		name: 'search_patterns',
		description:
			'Search the v10r pattern library by capability, feature, or concept. Start here to find which proven pattern to emulate; follow up with get_pattern for the full record.',
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
				limit: { type: 'integer', minimum: 1, maximum: 20, default: 5, description: 'Max results (1-20). Default 5.' },
				category: {
					type: 'string',
					maxLength: MAX_ARG_CHARS,
					description: 'Optional exact category filter — use a category value from any search result.',
				},
			},
			required: ['query'],
		},
	},
	{
		name: 'get_pattern',
		description:
			'Fetch the full curated card for one pattern: summary, when to use, docs to read, code entry points, tests, showcase proof, invariants that MUST hold when emulating, and emulation notes.',
		inputSchema: {
			type: 'object',
			additionalProperties: false,
			properties: {
				id: {
					type: 'string',
					maxLength: MAX_ARG_CHARS,
					description: 'Exact pattern id from search_patterns results, e.g. "layered-rag" or "multi-client-core".',
				},
			},
			required: ['id'],
		},
	},
	{
		name: 'get_file_excerpt',
		description:
			'Read a bounded, line-numbered excerpt of a reference file. On the hosted endpoint only files referenced by the pattern registry can be read — use the repo-relative paths returned by get_pattern or trace_capability.',
		inputSchema: {
			type: 'object',
			additionalProperties: false,
			properties: {
				path: {
					type: 'string',
					maxLength: MAX_ARG_CHARS,
					description:
						'Repo-relative path from a pattern card, e.g. "src/lib/server/ai/tools/index.ts". Only registry-referenced files are readable; anything else is rejected.',
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
			'Assemble a dependency-ordered emulation plan for a set of desired capabilities. Deterministic registry assembly (no inference): selects matching patterns, expands prerequisites, orders them topologically, and attaches the invariants you must preserve.',
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
			},
			required: ['capabilities'],
		},
	},
	{
		name: 'validate_snippet',
		description:
			'Validate a Svelte or TypeScript snippet against v10r conventions (Svelte 5 runes, component-first, design tokens, Valibot). Returns line-numbered findings with fixes — findings are a successful validation, not an error. Call in a loop: submit, apply the fixes, resubmit until it reports clean.',
		inputSchema: {
			type: 'object',
			additionalProperties: false,
			properties: {
				snippet: {
					type: 'string',
					maxLength: MAX_SNIPPET_CHARS,
					description: `The code to validate (at most ${MAX_SNIPPET_CHARS} characters — larger snippets are refused, never truncated).`,
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
	},
];

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function refLines(refs: RegRef[]): string {
	if (refs.length === 0) return '- (none)';
	return refs.map((ref) => `- ${ref.path}${ref.note ? ` — ${ref.note}` : ''}`).join('\n');
}

function noMatchHelp(what: string): string {
	const categories = [...new Set(PATTERNS.map((pattern) => pattern.category))].join(', ');
	const sample = PATTERNS.flatMap((pattern) => pattern.capabilities.slice(0, 1))
		.slice(0, 8)
		.join('", "');
	return `No pattern matched ${what}. Available categories: ${categories}. Example capability tags: "${sample}". Try broader terms, or list everything with search_patterns query "pattern".`;
}

/** The universal fallback step: `{query: "pattern"}` matches every record, so it lists the library. */
const LIST_EVERYTHING: NextAction = {
	tool: 'search_patterns',
	args: { query: 'pattern' },
	why: 'lists every pattern in the library.',
};

/**
 * A genuine no-match: the query ran and the registry had nothing for it. This is THE improvement
 * signal — it names a capability a consumer wanted that we do not cover.
 *
 * Setting the diag here rather than at each call site means a future no-match branch physically
 * cannot forget it. Note that not every caller of `noMatchHelp` is a no-match: an unknown category
 * filter reuses the same help text but never ran a query, so it stays `invalid_args` and is
 * deliberately NOT routed through here — otherwise a typo'd filter would pollute the gaps report.
 */
function noMatchResult(what: string): ToolResult {
	return errorResult(noMatchHelp(what), 'empty', [
		LIST_EVERYTHING,
		{ tool: 'trace_capability', args: { capability: 'rag' }, why: 'traces one capability end to end as a model.' },
	]);
}

function patternCard(pattern: PatternRecord): string {
	const header = [
		`# ${pattern.title} (\`${pattern.id}\`)`,
		'',
		`**Category:** ${pattern.category} · **Tier:** ${pattern.tier} · **Risk:** ${pattern.risk}`,
		pattern.depends_on.length > 0 ? `**Depends on:** ${pattern.depends_on.join(', ')}` : '',
		'',
		pattern.summary,
		'',
		`**When to use:** ${pattern.when_to_use}`,
		'',
	];
	if (pattern.tier === 'light') {
		// Index row: pointers only — render just the non-empty ref sections and say
		// where the depth lives instead of printing empty invariant headings.
		return [
			...header,
			`## Docs to read\n${refLines(pattern.docs)}`,
			pattern.code.length > 0 ? `## Code entry points\n${refLines(pattern.code)}` : '',
			pattern.tests.length > 0 ? `## Tests that pin it\n${refLines(pattern.tests)}` : '',
			pattern.showcases.length > 0 ? `## Showcase proof\n${refLines(pattern.showcases)}` : '',
			'',
			'_Index record — the docs above are the canonical explanation; deep-tier cards carry invariants and emulation notes._',
		]
			.filter((section) => section.length > 0)
			.join('\n');
	}
	return [
		...header,
		`## Docs to read\n${refLines(pattern.docs)}`,
		`## Code entry points\n${refLines(pattern.code)}`,
		`## Tests that pin it\n${refLines(pattern.tests)}`,
		`## Showcase proof\n${refLines(pattern.showcases)}`,
		`## Invariants (must hold when emulating)\n${pattern.invariants.map((rule) => `- ${rule}`).join('\n')}`,
		`## Emulation notes\n${pattern.emulation_notes.map((note) => `- ${note}`).join('\n')}`,
	]
		.filter((section) => section.length > 0)
		.join('\n');
}

function searchPatterns(args: Record<string, unknown>): ToolResult {
	const query = boundedString(args.query) ?? '';
	if (query.trim().length === 0) {
		return errorResult(
			`search_patterns needs a non-empty "query" string of at most ${MAX_ARG_CHARS} characters, e.g. {"query": "background jobs"}.`,
			'invalid_args',
			[{ tool: 'search_patterns', args: { query: 'background jobs' }, why: 'a well-formed example call.' }],
		);
	}
	const limit = typeof args.limit === 'number' ? Math.min(Math.max(1, Math.floor(args.limit)), 20) : 5;
	// Absent is "no filter"; present-but-unbounded is a client bug, not a wider
	// search — dropping it silently would quietly return MORE than was asked for.
	if (args.category !== undefined && boundedString(args.category) === null) {
		return errorResult(`"category" must be a string of at most ${MAX_ARG_CHARS} characters.`, 'invalid_args', [
			LIST_EVERYTHING,
		]);
	}
	const category = typeof args.category === 'string' ? args.category.toLowerCase() : null;
	const pool = category ? PATTERNS.filter((pattern) => pattern.category === category) : PATTERNS;
	// NOT a no-match: an unrecognised category filter means the query never ran, so this is a client
	// bug. Classifying it `empty` would fill the capability-gaps report with typo'd filter names.
	if (category && pool.length === 0) {
		return errorResult(noMatchHelp(`category "${category}"`), 'invalid_args', [LIST_EVERYTHING]);
	}
	const scored = scorePatterns(query, pool).slice(0, limit);
	if (scored.length === 0) return noMatchResult(`query "${query}"`);
	const lines = scored.map(
		(hit, index) =>
			`${index + 1}. **${hit.pattern.title}** (\`${hit.pattern.id}\`, ${hit.pattern.category}, ${hit.pattern.tier})\n   ${hit.pattern.summary}\n   _matched: ${hit.matchedTerms.join(', ') || 'title'} in ${hit.matchedFields.join(', ')}_`,
	);
	return textResult(
		`Found ${scored.length} pattern(s) for "${query}":\n\n${lines.join('\n')}\n\nNext: call get_pattern with an id for the full card.`,
	);
}

function getPattern(args: Record<string, unknown>): ToolResult {
	// Bounded before use: the not-found branch echoes the id back into the error
	// text and into the telemetry row, so an unbounded id is a reflection channel.
	const id = boundedString(args.id);
	if (id === null) {
		return errorResult(`"id" must be a string of at most ${MAX_ARG_CHARS} characters.`, 'invalid_args', [
			LIST_EVERYTHING,
		]);
	}
	const pattern = buildById().get(id);
	if (!pattern) {
		// A real-shaped id we do not have is a REGISTRY GAP, not a malformed request.
		// 136 ids would be ~3 KB of error text — cap the reflection, point at search.
		const more = PATTERNS.length > 20 ? `, … (${PATTERNS.length} total — search_patterns finds the rest)` : '';
		return errorResult(
			`No pattern with id "${id}". Valid ids: ${PATTERNS.slice(0, 20)
				.map((entry) => entry.id)
				.join(', ')}${more}.`,
			'not_found',
			[
				{ tool: 'get_pattern', args: { id: PATTERNS[0].id }, why: 'a valid id from the list above.' },
				{ tool: 'search_patterns', args: { query: 'pattern' }, why: 'find the right id by capability.' },
			],
		);
	}
	return textResult(patternCard(pattern));
}

function getFileExcerpt(args: Record<string, unknown>): ToolResult {
	const path = boundedString(args.path);
	if (path === null) {
		return errorResult(`"path" must be a string of at most ${MAX_ARG_CHARS} characters.`, 'invalid_args', [
			{ tool: 'get_pattern', why: 'pattern cards list the repo-relative paths this tool can read.' },
		]);
	}
	const startLine = typeof args.start_line === 'number' ? args.start_line : 1;
	const lineCount = typeof args.line_count === 'number' ? args.line_count : DEFAULT_LINES;
	const excerpt = readAllowlistedExcerpt(path, startLine, lineCount);
	// The discriminated union carries the reason across; there is deliberately no `??` fallback,
	// because a default here is how a new failure branch would silently get the wrong reason.
	return excerpt.ok ? textResult(excerpt.text) : errorResult(excerpt.text, excerpt.diag, excerpt.next);
}

function traceCapability(args: Record<string, unknown>): ToolResult {
	const capability = boundedString(args.capability) ?? '';
	if (capability.trim().length === 0) {
		return errorResult(
			`trace_capability needs a non-empty "capability" string of at most ${MAX_ARG_CHARS} characters, e.g. {"capability": "approval gate"}.`,
			'invalid_args',
			[{ tool: 'trace_capability', args: { capability: 'approval gate' }, why: 'a well-formed example call.' }],
		);
	}
	const scored = scorePatterns(capability).slice(0, 3);
	if (scored.length === 0) return noMatchResult(`capability "${capability}"`);
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
	return textResult(
		`Trace for "${capability}" (${scored.length} matching pattern(s), concept → docs → code → tests → proof):\n\n${sections.join('\n\n')}`,
	);
}

function recommendPlan(args: Record<string, unknown>): ToolResult {
	// The array bound is the real control on this tool: the loop below runs
	// scorePatterns over the whole registry once per entry, so length is CPU
	// spend on an unauthenticated endpoint. Refuse the call rather than truncate
	// — a plan silently built from the first 20 of 5000 capabilities looks
	// complete and is not.
	if (Array.isArray(args.capabilities) && args.capabilities.length > MAX_CAPABILITIES) {
		return errorResult(
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
		return errorResult(
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
	const includeDeps = args.include_dependencies !== false;
	const byId = buildById();
	// Plan steps come from DEEP records only — a step without invariants is noise.
	// Capabilities that only match light index rows are reported in a trailer so
	// the gap is visible (and a promotion candidate) instead of silently dropped.
	const lightPatterns = PATTERNS.filter((pattern) => pattern.tier === 'light');
	const satisfies = new Map<string, string[]>();
	const lightOnly: string[] = [];
	const unmatched: string[] = [];
	for (const capability of capabilities) {
		const scored = scorePatterns(capability, DEEP_PATTERNS);
		const best = scored.filter((hit) => hit.score >= (scored[0]?.score ?? 0) / 2).slice(0, 2);
		if (best.length === 0) {
			const lightHits = scorePatterns(capability, lightPatterns).slice(0, 2);
			if (lightHits.length > 0) {
				lightOnly.push(`"${capability}" → ${lightHits.map((hit) => `\`${hit.pattern.id}\``).join(', ')}`);
			} else {
				unmatched.push(capability);
			}
			continue;
		}
		for (const hit of best) {
			satisfies.set(hit.pattern.id, [...(satisfies.get(hit.pattern.id) ?? []), capability]);
		}
	}
	if (satisfies.size === 0 && lightOnly.length === 0) {
		return noMatchResult(`capabilities [${capabilities.join(', ')}]`);
	}
	if (satisfies.size === 0) {
		return textResult(
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
	const { order, cyclic } = topoSort([...selected], byId, REGISTRY_ORDER);
	const steps = order.map((id, index) => {
		const pattern = byId.get(id);
		if (!pattern) return `${index + 1}. ${id}`;
		const covers = satisfies.get(id);
		return [
			`### Step ${index + 1}: ${pattern.title} (\`${id}\`)`,
			covers ? `Satisfies: ${covers.join(', ')}` : 'Included as prerequisite (depends_on).',
			`Risk: ${pattern.risk}`,
			`Read:\n${refLines(pattern.docs)}`,
			`Model on:\n${refLines(pattern.code)}`,
			pattern.tests.length > 0 ? `Mirror tests:\n${refLines(pattern.tests)}` : '',
			`Invariants:\n${pattern.invariants.map((rule) => `- ${rule}`).join('\n')}`,
		]
			.filter((line) => line.length > 0)
			.join('\n');
	});
	const notes = [
		'Assembled deterministically from the registry — no inference. Adapt each pattern to the target project; emulate, do not clone.',
		lightOnly.length > 0 ? `Related index entries (no deep card yet): ${lightOnly.join('; ')}.` : '',
		unmatched.length > 0
			? `Unmatched capabilities (no registry entry yet — cover manually or search with different terms): ${unmatched.join(', ')}.`
			: '',
		cyclic ? 'Warning: dependency cycle detected; order is best-effort.' : '',
	].filter((line) => line.length > 0);
	return textResult(
		`# Emulation plan (${order.length} pattern(s), dependency-ordered)\n\n${steps.join('\n\n')}\n\n---\n${notes.map((note) => `- ${note}`).join('\n')}`,
	);
}

function validateSnippetTool(args: Record<string, unknown>): ToolResult {
	// Its own bound, not MAX_ARG_CHARS: a snippet is legitimately larger than any other
	// argument on this surface, and the bound is stated in the schema. Refuse rather than
	// truncate — a partially validated snippet reads as clean and is not.
	const snippet = typeof args.snippet === 'string' && args.snippet.length <= MAX_SNIPPET_CHARS ? args.snippet : null;
	if (snippet === null || snippet.trim().length === 0) {
		return errorResult(
			`"snippet" must be a non-empty string of at most ${MAX_SNIPPET_CHARS} characters. Refused rather than truncated — a partially validated snippet reads as clean.`,
			'invalid_args',
			[{ tool: 'validate_snippet', args: { language: 'svelte' }, why: 'resubmit with the snippet argument set.' }],
		);
	}
	const language = args.language === 'ts' ? 'ts' : 'svelte';
	// Findings are a SUCCESS, not an error: this is a completed validation, an isError
	// would make agent loops treat the normal case as a failure, and it would mint
	// mcp.call_log rows that corrupt the capability-gaps meter.
	return textResult(renderReport(validateSnippet(snippet, language)));
}

const HANDLERS: Record<string, (args: Record<string, unknown>) => ToolResult> = {
	search_patterns: searchPatterns,
	get_pattern: getPattern,
	get_file_excerpt: getFileExcerpt,
	trace_capability: traceCapability,
	recommend_emulation_plan: recommendPlan,
	validate_snippet: validateSnippetTool,
};

/** The public read-only Pattern MCP registry. */
export const publicPatternRegistry: ToolRegistry = {
	tools: PATTERN_TOOLS,
	dispatch(name, args) {
		const handler = HANDLERS[name];
		if (!handler) {
			return errorResult(
				`Unknown tool "${name}". Available: ${PATTERN_TOOLS.map((tool) => tool.name).join(', ')}.`,
				'unknown_tool',
				[LIST_EVERYTHING],
			);
		}
		return handler(isRecord(args) ? args : {});
	},
};

export const PUBLIC_MCP_INSTRUCTIONS =
	'Hosted, read-only mirror of the v10r pattern library. search_patterns / trace_capability to find the canonical pattern, get_pattern for its full card with invariants, get_file_excerpt to read allowlisted reference files, recommend_emulation_plan for a dependency-ordered build plan, validate_snippet to check code you wrote against v10r conventions (loop on it until clean). Read-only: no state is mutated.';
