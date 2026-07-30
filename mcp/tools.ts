/**
 * The six read-only tools of the v10r Pattern MCP: definitions (name/description/inputSchema
 * only — no outputSchema/title/annotations, which trigger a Claude Code bug that silently drops
 * the whole server's tool list) and their handlers over the pattern registry.
 */
import type { PatternRecord, Registry, RegRef } from './registry.ts';
import { buildById, topoSort } from './registry.ts';
import { DEFAULT_LINES, MAX_LINES, readExcerpt } from './security.ts';
import { validateSnippetStdio } from './snippet.ts';

export interface ToolDef {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
}

export interface ToolResult {
	content: Array<{ type: 'text'; text: string }>;
	isError?: boolean;
}

export interface ToolContext {
	registry: Registry | null;
	loadError: string | null;
	root?: string;
}

const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'for', 'to', 'and', 'with', 'in', 'on', 'is', 'how', 'what']);

export const TOOLS: ToolDef[] = [
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
					description:
						'Natural-language or keyword query describing the capability you are looking for — e.g. "background jobs", "approval gate for AI tools", "grounded answers over a corpus".',
				},
				limit: { type: 'integer', minimum: 1, maximum: 20, default: 5, description: 'Max results (1-20). Default 5.' },
				category: {
					type: 'string',
					description: 'Optional exact category filter: architecture, ai, ui, docs, or jobs.',
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
					description: 'Exact pattern id from search_patterns results, e.g. "layered-rag" or "multi-client-core".',
				},
			},
			required: ['id'],
		},
	},
	{
		name: 'get_file_excerpt',
		description:
			'Read a bounded, line-numbered excerpt of a reference file in the v10r repo. Use the repo-relative paths returned by get_pattern or trace_capability.',
		inputSchema: {
			type: 'object',
			additionalProperties: false,
			properties: {
				path: {
					type: 'string',
					description:
						'Repo-relative path from the v10r root, e.g. "src/lib/server/ai/tools/index.ts". Absolute paths, ".." traversal, and secret files (.env, *.pem, .git/, node_modules/) are rejected.',
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
					items: { type: 'string' },
					minItems: 1,
					description:
						'Capabilities the target project needs — e.g. ["layered RAG", "background jobs", "design system"].',
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
					description:
						'The code to validate (at most 20000 characters — larger snippets are refused, never truncated).',
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

/**
 * Results are text-only by design: when structuredContent is present, Claude Code shows
 * the model ONLY the structured payload and hides the text body (observed in E2E) —
 * and community practice favors markdown over nested JSON for agent consumption anyway.
 */
function text(body: string): ToolResult {
	return { content: [{ type: 'text', text: body }] };
}

/**
 * Zero-dep mirror of the hosted Next-actions convention (src/lib/server/mcp/types.ts —
 * never imported from here; mcp/ stays standalone). The heading literal is pinned to the
 * hosted one by next-actions.gate.test.ts. `args` values are ALWAYS literals we wrote,
 * never caller text.
 */
export const NEXT_ACTIONS_HEADING = '## Next actions';

interface NextAction {
	tool: string;
	args?: Record<string, unknown>;
	why: string;
}

/** `actions` is required for the same reason the hosted `errorResult` requires it: a new
 *  error branch that strands the caller must be a missing-argument error, not a review miss. */
function fail(body: string, actions: readonly NextAction[]): ToolResult {
	const lines = actions.slice(0, 3).map((action, index) => {
		const args = action.args ? ` ${JSON.stringify(action.args)}` : '';
		return `${index + 1}. \`${action.tool}\`${args} — ${action.why}`;
	});
	const body2 = actions.length === 0 ? body : `${body}\n\n${NEXT_ACTIONS_HEADING}\n${lines.join('\n')}`;
	return { content: [{ type: 'text', text: body2 }], isError: true };
}

/** The universal fallback step: `{query: "pattern"}` matches every record, so it lists the library. */
const LIST_EVERYTHING: NextAction = {
	tool: 'search_patterns',
	args: { query: 'pattern' },
	why: 'lists every pattern in the library.',
};

export function tokenize(input: string): string[] {
	return input
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

interface Scored {
	pattern: PatternRecord;
	score: number;
	matchedTerms: string[];
	matchedFields: string[];
}

const FIELD_WEIGHTS: Array<[string, number, (p: PatternRecord) => string[]]> = [
	['title', 5, (p) => [p.title]],
	['keywords', 4, (p) => p.keywords],
	['capabilities', 4, (p) => p.capabilities],
	['category', 3, (p) => [p.category]],
	['summary', 2, (p) => [p.summary]],
	['invariants', 1, (p) => p.invariants],
];

export function scorePatterns(query: string, patterns: PatternRecord[]): Scored[] {
	const queryTokens = tokenize(query);
	const fullQuery = query.trim().toLowerCase();
	const results: Scored[] = [];
	for (const pattern of patterns) {
		let score = 0;
		const matchedTerms = new Set<string>();
		const matchedFields = new Set<string>();
		for (const [field, weight, getter] of FIELD_WEIGHTS) {
			const fieldTokens = getter(pattern).flatMap(tokenize);
			for (const token of queryTokens) {
				if (fieldTokens.includes(token)) {
					score += weight;
					matchedTerms.add(token);
					matchedFields.add(field);
				} else if (fieldTokens.some((candidate) => candidate.startsWith(token))) {
					score += weight / 2;
					matchedTerms.add(token);
					matchedFields.add(field);
				}
			}
		}
		if (fullQuery.length > 3 && pattern.title.toLowerCase().includes(fullQuery)) {
			score += 3;
			matchedFields.add('title');
		}
		if (score > 0) {
			results.push({ pattern, score, matchedTerms: [...matchedTerms], matchedFields: [...matchedFields] });
		}
	}
	return results.sort((a, b) => b.score - a.score || a.pattern.id.localeCompare(b.pattern.id));
}

function refLines(refs: RegRef[]): string {
	if (refs.length === 0) {
		return '- (none)';
	}
	return refs.map((ref) => `- ${ref.path}${ref.note ? ` — ${ref.note}` : ''}`).join('\n');
}

function noMatchHelp(registry: Registry, what: string): string {
	const categories = [...new Set(registry.patterns.map((pattern) => pattern.category))].join(', ');
	const sample = registry.patterns
		.flatMap((pattern) => pattern.capabilities.slice(0, 1))
		.slice(0, 8)
		.join('", "');
	return `No pattern matched ${what}. Available categories: ${categories}. Example capability tags: "${sample}". Try broader terms, or list everything with search_patterns query "pattern".`;
}

function patternCard(pattern: PatternRecord): string {
	return [
		`# ${pattern.title} (\`${pattern.id}\`)`,
		'',
		`**Category:** ${pattern.category} · **Risk:** ${pattern.risk}`,
		pattern.depends_on.length > 0 ? `**Depends on:** ${pattern.depends_on.join(', ')}` : '',
		'',
		pattern.summary,
		'',
		`**When to use:** ${pattern.when_to_use}`,
		'',
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

function searchPatterns(args: Record<string, unknown>, registry: Registry): ToolResult {
	const query = typeof args.query === 'string' ? args.query : '';
	if (query.trim().length === 0) {
		return fail('search_patterns needs a non-empty "query" string, e.g. {"query": "background jobs"}.', [
			{ tool: 'search_patterns', args: { query: 'background jobs' }, why: 'a well-formed example call.' },
		]);
	}
	const limit = typeof args.limit === 'number' ? Math.min(Math.max(1, Math.floor(args.limit)), 20) : 5;
	const category = typeof args.category === 'string' ? args.category.toLowerCase() : null;
	const pool = category ? registry.patterns.filter((pattern) => pattern.category === category) : registry.patterns;
	if (category && pool.length === 0) {
		return fail(noMatchHelp(registry, `category "${category}"`), [LIST_EVERYTHING]);
	}
	const scored = scorePatterns(query, pool).slice(0, limit);
	if (scored.length === 0) {
		return fail(noMatchHelp(registry, `query "${query}"`), [
			LIST_EVERYTHING,
			{ tool: 'trace_capability', args: { capability: 'rag' }, why: 'traces one capability end to end as a model.' },
		]);
	}
	const lines = scored.map(
		(hit, index) =>
			`${index + 1}. **${hit.pattern.title}** (\`${hit.pattern.id}\`, ${hit.pattern.category})\n   ${hit.pattern.summary}\n   _matched: ${hit.matchedTerms.join(', ') || 'title'} in ${hit.matchedFields.join(', ')}_`,
	);
	return text(
		`Found ${scored.length} pattern(s) for "${query}":\n\n${lines.join('\n')}\n\nNext: call get_pattern with an id for the full card.`,
	);
}

function getPattern(args: Record<string, unknown>, registry: Registry): ToolResult {
	const id = typeof args.id === 'string' ? args.id : '';
	const byId = buildById(registry);
	const pattern = byId.get(id);
	if (!pattern) {
		const ids = registry.patterns.map((entry) => entry.id).join(', ');
		return fail(`No pattern with id "${id}". Valid ids: ${ids}.`, [
			{
				tool: 'get_pattern',
				args: { id: registry.patterns[0]?.id ?? 'multi-client-core' },
				why: 'a valid id from the list above.',
			},
			{ tool: 'search_patterns', args: { query: 'pattern' }, why: 'find the right id by capability.' },
		]);
	}
	return text(patternCard(pattern));
}

function getFileExcerpt(args: Record<string, unknown>, root?: string): ToolResult {
	const path = typeof args.path === 'string' ? args.path : '';
	const startLine = typeof args.start_line === 'number' ? args.start_line : 1;
	const lineCount = typeof args.line_count === 'number' ? args.line_count : DEFAULT_LINES;
	let excerpt: ReturnType<typeof readExcerpt>;
	try {
		excerpt = root ? readExcerpt(path, startLine, lineCount, root) : readExcerpt(path, startLine, lineCount);
	} catch (cause) {
		return fail(`could not read '${path}': ${String(cause)}`, [
			{ tool: 'get_pattern', why: 'pattern cards list the repo-relative paths this tool can read.' },
		]);
	}
	if (!excerpt.ok) {
		return fail(excerpt.text, [
			{ tool: 'get_pattern', why: 'pattern cards list the repo-relative paths this tool can read.' },
		]);
	}
	return text(excerpt.text);
}

function traceCapability(args: Record<string, unknown>, registry: Registry): ToolResult {
	const capability = typeof args.capability === 'string' ? args.capability : '';
	if (capability.trim().length === 0) {
		return fail('trace_capability needs a non-empty "capability" string, e.g. {"capability": "approval gate"}.', [
			{ tool: 'trace_capability', args: { capability: 'approval gate' }, why: 'a well-formed example call.' },
		]);
	}
	const scored = scorePatterns(capability, registry.patterns).slice(0, 3);
	if (scored.length === 0) {
		return fail(noMatchHelp(registry, `capability "${capability}"`), [LIST_EVERYTHING]);
	}
	const sections = scored.map((hit) => {
		const pattern = hit.pattern;
		return [
			`## ${pattern.title} (\`${pattern.id}\`)`,
			`**Concept:** ${pattern.summary} ${pattern.when_to_use}`,
			`**Docs:**\n${refLines(pattern.docs)}`,
			`**Code:**\n${refLines(pattern.code)}`,
			`**Tests:**\n${refLines(pattern.tests)}`,
			`**Proof:**\n${refLines(pattern.showcases)}`,
			`**Invariants:**\n${pattern.invariants.map((rule) => `- ${rule}`).join('\n')}`,
		].join('\n');
	});
	return text(
		`Trace for "${capability}" (${scored.length} matching pattern(s), concept → docs → code → tests → proof):\n\n${sections.join('\n\n')}`,
	);
}

function recommendPlan(args: Record<string, unknown>, registry: Registry): ToolResult {
	const capabilities = Array.isArray(args.capabilities)
		? args.capabilities.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
		: [];
	if (capabilities.length === 0) {
		return fail(
			'recommend_emulation_plan needs "capabilities": a non-empty array of strings, e.g. ["layered RAG", "background jobs"].',
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
	const byId = buildById(registry);
	const registryOrder = registry.patterns.map((pattern) => pattern.id);
	const satisfies = new Map<string, string[]>();
	const unmatched: string[] = [];
	for (const capability of capabilities) {
		const scored = scorePatterns(capability, registry.patterns);
		const best = scored.filter((hit) => hit.score >= (scored[0]?.score ?? 0) / 2).slice(0, 2);
		if (best.length === 0) {
			unmatched.push(capability);
			continue;
		}
		for (const hit of best) {
			satisfies.set(hit.pattern.id, [...(satisfies.get(hit.pattern.id) ?? []), capability]);
		}
	}
	if (satisfies.size === 0) {
		return fail(noMatchHelp(registry, `capabilities [${capabilities.join(', ')}]`), [LIST_EVERYTHING]);
	}
	const selected = new Set(satisfies.keys());
	if (includeDeps) {
		const queue = [...selected];
		while (queue.length > 0) {
			const current = queue.pop();
			if (current === undefined) {
				break;
			}
			for (const dep of byId.get(current)?.depends_on ?? []) {
				if (!selected.has(dep)) {
					selected.add(dep);
					queue.push(dep);
				}
			}
		}
	}
	const { order, cyclic } = topoSort([...selected], byId, registryOrder);
	const steps = order.map((id, index) => {
		const pattern = byId.get(id);
		if (!pattern) {
			return `${index + 1}. ${id}`;
		}
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
		unmatched.length > 0
			? `Unmatched capabilities (no registry entry yet — cover manually or search with different terms): ${unmatched.join(', ')}.`
			: '',
		cyclic ? 'Warning: dependency cycle detected; order is best-effort.' : '',
	].filter((line) => line.length > 0);
	return text(
		`# Emulation plan (${order.length} pattern(s), dependency-ordered)\n\n${steps.join('\n\n')}\n\n---\n${notes.map((note) => `- ${note}`).join('\n')}`,
	);
}

export function handleToolCall(name: string, args: unknown, ctx: ToolContext): ToolResult {
	const known = TOOLS.some((tool) => tool.name === name);
	if (!known) {
		return fail(`Unknown tool "${name}". Available: ${TOOLS.map((tool) => tool.name).join(', ')}.`, [LIST_EVERYTHING]);
	}
	const params = isRecord(args) ? args : {};
	if (name === 'get_file_excerpt') {
		return getFileExcerpt(params, ctx.root);
	}
	if (name === 'validate_snippet') {
		// Findings are a SUCCESS (a completed validation); only malformed arguments or a
		// broken rule file are errors.
		const outcome = ctx.root ? validateSnippetStdio(params, ctx.root) : validateSnippetStdio(params);
		return outcome.ok
			? text(outcome.text)
			: fail(outcome.text, [
					{ tool: 'validate_snippet', args: { language: 'svelte' }, why: 'resubmit with the snippet argument set.' },
				]);
	}
	if (!ctx.registry) {
		return fail(
			`The pattern registry failed to load: ${ctx.loadError ?? 'unknown error'}. Fix mcp/patterns.registry.json and restart.`,
			[
				{
					tool: 'get_file_excerpt',
					args: { path: 'mcp/patterns.registry.json' },
					why: 'still works without the registry — read the file to see what is malformed.',
				},
			],
		);
	}
	switch (name) {
		case 'search_patterns':
			return searchPatterns(params, ctx.registry);
		case 'get_pattern':
			return getPattern(params, ctx.registry);
		case 'trace_capability':
			return traceCapability(params, ctx.registry);
		case 'recommend_emulation_plan':
			return recommendPlan(params, ctx.registry);
		default:
			return fail(`Tool "${name}" is defined but has no handler — this is a server bug.`, [LIST_EVERYTHING]);
	}
}
