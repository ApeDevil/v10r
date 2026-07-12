/**
 * Hand-curated projections of the MCP server's five tool definitions
 * (mcp/tools.ts TOOLS) and its handshake sequence (mcp/smoke.ts) for the
 * Pattern MCP showcase. Mirrored as literals because mcp/*.ts is Bun-typed and
 * outside the app's TS program; tool-cards.drift.test.ts pins the tool names
 * against the source so a sixth tool can't land silently.
 */
export interface ToolCard {
	name: string;
	icon: string;
	summary: string;
	params: Array<{ name: string; detail: string }>;
}

export const TOOL_CARDS: ToolCard[] = [
	{
		name: 'search_patterns',
		icon: 'i-lucide-search',
		summary:
			'Search the pattern library by capability, feature, or concept — the entry point; follow up with get_pattern.',
		params: [
			{ name: 'query', detail: 'natural-language or keyword query (required)' },
			{ name: 'limit', detail: 'max results, 1–20, default 5' },
			{ name: 'category', detail: 'optional exact filter: architecture, ai, ui, docs, jobs' },
		],
	},
	{
		name: 'get_pattern',
		icon: 'i-lucide-file-text',
		summary:
			'Fetch the full curated card for one pattern: docs, code entry points, tests, showcase proof, invariants, emulation notes.',
		params: [{ name: 'id', detail: 'exact pattern id, e.g. "layered-rag" (required)' }],
	},
	{
		name: 'get_file_excerpt',
		icon: 'i-lucide-file-code',
		summary:
			'Read a bounded, line-numbered excerpt of a referenced repo file. Secret paths and traversal are rejected.',
		params: [
			{ name: 'path', detail: 'repo-relative path (required)' },
			{ name: 'start_line', detail: '1-based start line, default 1' },
			{ name: 'line_count', detail: '1–250 lines, default 100' },
		],
	},
	{
		name: 'trace_capability',
		icon: 'i-lucide-route',
		summary: 'Trace a capability end-to-end: concept → docs → code → tests → showcase proof, with invariants attached.',
		params: [{ name: 'capability', detail: 'capability or concept to trace (required)' }],
	},
	{
		name: 'recommend_emulation_plan',
		icon: 'i-lucide-list-checks',
		summary:
			'Assemble a dependency-ordered emulation plan — deterministic registry assembly with prerequisites, no inference.',
		params: [
			{ name: 'capabilities', detail: 'list of desired capabilities (required)' },
			{ name: 'include_dependencies', detail: 'expand prerequisites via depends_on, default true' },
		],
	},
];

export interface HandshakeStep {
	method: string;
	kind: 'request' | 'notification';
	purpose: string;
}

/** The real client → server sequence, as exercised by mcp/smoke.ts. */
export const HANDSHAKE_STEPS: HandshakeStep[] = [
	{
		method: 'initialize',
		kind: 'request',
		purpose: 'Protocol version negotiation; the server returns capabilities, serverInfo, and its instructions text.',
	},
	{
		method: 'notifications/initialized',
		kind: 'notification',
		purpose: 'Client signals readiness. Notifications never get a reply.',
	},
	{
		method: 'tools/list',
		kind: 'request',
		purpose: 'Returns the five tool definitions — name, description, and inputSchema only.',
	},
	{
		method: 'tools/call',
		kind: 'request',
		purpose: 'Executes one tool; repeated per invocation. Failures come back as isError results, never crashes.',
	},
];
