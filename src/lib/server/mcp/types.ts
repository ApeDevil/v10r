/**
 * Shared MCP types for the hosted (HTTP) transport. The public and admin endpoints share
 * this transport contract but each supplies its OWN ToolRegistry — the registries and their
 * dispatch allowlists are separate, so a tool that is not in a registry cannot be dispatched
 * through it regardless of what a caller submits.
 */

/** JSON-RPC id: string, number, or null. Absent entirely on notifications. */
export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
	jsonrpc?: string;
	id?: JsonRpcId;
	method?: string;
	params?: unknown;
}

export interface JsonRpcSuccess {
	jsonrpc: '2.0';
	id: JsonRpcId;
	result: unknown;
}

export interface JsonRpcError {
	jsonrpc: '2.0';
	id: JsonRpcId;
	error: { code: number; message: string; data?: unknown };
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;

/** Standard JSON-RPC error codes used by the transport. */
export const RPC = {
	PARSE: -32700,
	INVALID_REQ: -32600,
	NO_METHOD: -32601,
	BAD_PARAMS: -32602,
	INTERNAL: -32603,
} as const;

/** A tool definition — name/description/inputSchema only (MCP tools/list shape). */
export interface ToolDef {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
}

/**
 * Why a tool result failed — INTERNAL telemetry, never serialized to the wire.
 *
 * A CLOSED union on purpose. The obvious alternative, a free-form string, would be an unbounded
 * caller-adjacent field on a privacy-sensitive path; with a closed vocabulary even a strip-site
 * regression can only leak a fixed word, never data. It also makes the mapping onto the
 * `mcp.call_log` outcome enum total and exhaustiveness-checkable.
 *
 * `snapshot_miss` is an OPERATOR alarm rather than a caller error: the path is allowlisted but
 * absent from the build-time excerpt snapshot, which means `mcp:excerpts:build` drifted.
 */
export type ToolDiag =
	| 'empty' //          well-formed request that matched nothing — the improvement signal
	| 'invalid_args' //   the caller's arguments were malformed or missing
	| 'not_found' //      a real-shaped identifier that does not exist — a registry gap
	| 'snapshot_miss' //  allowlisted but missing from the deployment snapshot — operator alarm
	| 'conflict' //       optimistic-concurrency loss (admin demo CAS) — not a client bug
	| 'unknown_tool'; //  registry-level defense-in-depth branch

/**
 * A tool result — text content blocks, with an optional error flag (never throws to the wire).
 *
 * `diag` is stripped by `toWire()` in http.ts before serialization and MUST NOT reach a caller.
 */
export interface ToolResult {
	content: Array<{ type: 'text'; text: string }>;
	isError?: boolean;
	diag?: ToolDiag;
}

/**
 * A trust-scoped set of tools plus the dispatcher that runs them. The transport only ever
 * dispatches a name that appears in `tools`; the dispatcher SHOULD also reject unknown names
 * as defense in depth.
 */
export interface ToolRegistry {
	readonly tools: readonly ToolDef[];
	dispatch(name: string, args: unknown): Promise<ToolResult> | ToolResult;
}

/**
 * Everything the HTTP layer can observe about one POST. Strictly per-request facts.
 *
 * What is ABSENT is the proof the boundary sits in the right place: no surface, no registry
 * version, no caller key, no traffic classification. Those are deploy constants or persistence
 * dimensions that the observer stamps — so `http.ts` never learns that public and admin exist, and
 * this contract is unaffected by how caller identity is (or is not) recorded.
 */
export interface McpCallObservation {
	/** JSON-RPC method, or null when the envelope never parsed. */
	method: string | null;
	/** Tool name from the body, or null. Authoritative — never taken from an untrusted header. */
	toolName: string | null;
	/** Why the tool failed, when a handler said so. Absent on transport-built errors — see ToolDiag. */
	diag: ToolDiag | null;
	/** True when the result carried `isError`, regardless of whether a diag came with it. */
	isError: boolean;
	/** Where the request stopped. Mirrors the `mcp_call_stage` ordinate. */
	stage: 'envelope' | 'protocol' | 'tool';
	/** HTTP status actually returned. Note most transport failures are 200 by design. */
	status: number;
	/** JSON-RPC error code when the envelope itself failed, else null. */
	rpcErrorCode: number | null;
	/** `initialize` params.clientInfo — self-reported, unverified, never a security input. */
	clientName: string | null;
	clientVersion: string | null;
	/** Protocol version the caller asked for vs the one negotiated. Kept apart on purpose: */
	/** recording only the negotiated value erases the migration signal at the moment of capture. */
	requestedProtocolVersion: string | null;
	servedProtocolVersion: string | null;
	/** Number of tools returned by `tools/list`, else null. */
	toolCount: number | null;
	/** Raw arguments. Redaction is the observer's job — never the transport's. */
	args: unknown;
	/** Time inside `respondToMcpPost`, i.e. dispatch plus envelope validation. */
	handleMs: number;
}

/**
 * The telemetry seam. `observe` returns `void`, and that is a structural guarantee rather than a
 * style choice: there is nothing for `http.ts` to await, so telemetry cannot add latency to, or
 * fail, an MCP response. The port also exposes no writer, so a caller physically cannot flush —
 * only the composition root can.
 */
export interface McpCallObserver {
	observe(observation: McpCallObservation): void;
}

/** For tests and for any caller that genuinely wants no telemetry. Frozen and side-effect free. */
export const noopMcpObserver: McpCallObserver = Object.freeze({ observe: () => {} });

export function textResult(body: string): ToolResult {
	return { content: [{ type: 'text', text: body }] };
}

/**
 * A concrete next step handed to the caller on every registry-produced error (the
 * "self-reflective API" pattern: agents recover measurably better from a named next
 * call than from prose alone).
 *
 * `args` values are ALWAYS literals the registry wrote — never caller text. The
 * existing bounded-echo discipline (get_pattern's id reflection) is the ceiling;
 * this block must add no echo surface of its own.
 */
export interface NextAction {
	tool: string;
	args?: Record<string, string | number | boolean | readonly string[]>;
	why: string;
}

export const NEXT_ACTIONS_HEADING = '## Next actions';
export const MAX_NEXT_ACTIONS = 3;

/**
 * Renders the trailer as TEXT inside the body. Not a structured result field: both
 * surfaces are text-only by hard-won convention (structuredContent makes Claude Code
 * hide the text body entirely), and a markdown block with a fixed heading is exactly
 * as machine-parsable while staying visible.
 *
 * Never throws — a throw inside a handler would surface as a diag-less transport
 * error and corrupt the `tool_error` meter. An empty array returns the body
 * unchanged; the gate test, not this function, forbids the empty case.
 */
export function withNextActions(body: string, actions: readonly NextAction[]): string {
	if (actions.length === 0) return body;
	const lines = actions.slice(0, MAX_NEXT_ACTIONS).map((action, index) => {
		const args = action.args ? ` ${JSON.stringify(action.args)}` : '';
		return `${index + 1}. \`${action.tool}\`${args} — ${action.why}`;
	});
	return `${body}\n\n${NEXT_ACTIONS_HEADING}\n${lines.join('\n')}`;
}

/**
 * `diag` is REQUIRED, and that is load-bearing rather than pedantic.
 *
 * The transport builds two `isError` results as inline literals that never come through here
 * (unknown-tool and tool-threw). Because every registry-produced error MUST carry a diag, the
 * recorder can infer `isError && diag === undefined ⟹ the transport produced this` — a TOTAL
 * inference, and total only because this parameter is required. Make it optional and that branch
 * becomes a guess, which in turn breaks `tool_error`, the meter that reports uninstrumented sites.
 *
 * `next` is required for the same reason: a new error branch that strands the caller
 * without a recovery step must be a compile error, not a review miss.
 */
export function errorResult(body: string, diag: ToolDiag, next: readonly NextAction[]): ToolResult {
	return { content: [{ type: 'text', text: withNextActions(body, next) }], isError: true, diag };
}
