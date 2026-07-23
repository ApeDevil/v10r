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

/** A tool result — text content blocks, with an optional error flag (never throws to the wire). */
export interface ToolResult {
	content: Array<{ type: 'text'; text: string }>;
	isError?: boolean;
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

export function textResult(body: string): ToolResult {
	return { content: [{ type: 'text', text: body }] };
}

export function errorResult(body: string): ToolResult {
	return { content: [{ type: 'text', text: body }], isError: true };
}
