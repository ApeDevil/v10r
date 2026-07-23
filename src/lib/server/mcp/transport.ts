/**
 * Framework-free MCP-over-HTTP dispatch, shared by the public and admin endpoints.
 *
 * One JSON-RPC message per POST → one JSON-RPC response (or nothing, for notifications).
 * This is the non-streaming variant of MCP Streamable HTTP: deterministic, bounded, and it
 * never throws to the wire — a tool that blows up comes back as an `isError` result.
 *
 * The transport is trust-agnostic: it dispatches ONLY names present in the supplied
 * registry's `tools`, so the same code enforces the public/admin separation just by being
 * handed a different registry.
 */

import { negotiateProtocolVersion } from './server-info';
import { type JsonRpcId, type JsonRpcRequest, type JsonRpcResponse, RPC, type ToolRegistry } from './types';

export interface McpServerIdentity {
	/** Server name reported in `serverInfo`, e.g. "v10r-mcp-public". */
	name: string;
	/** Server version reported in `serverInfo`. */
	version: string;
	/** Human/agent-facing usage guidance returned by `initialize`. */
	instructions: string;
	/** Optional extra metadata merged into the `initialize` result under `_meta`. */
	meta?: Record<string, unknown>;
}

function ok(id: JsonRpcId, result: unknown): JsonRpcResponse {
	return { jsonrpc: '2.0', id, result };
}

function fail(id: JsonRpcId, code: number, message: string): JsonRpcResponse {
	return { jsonrpc: '2.0', id, error: { code, message } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** JSON-RPC 2.0 ids must be string, number, or null (absent entirely for notifications). */
function isValidId(value: unknown): value is JsonRpcId {
	return value === null || typeof value === 'string' || typeof value === 'number';
}

/** A message with no `id` key at all is a notification — it never gets a reply. */
function isNotification(msg: JsonRpcRequest): boolean {
	return !('id' in msg);
}

async function handleToolsCall(params: unknown, id: JsonRpcId, registry: ToolRegistry): Promise<JsonRpcResponse> {
	if (!isRecord(params) || typeof params.name !== 'string') {
		return fail(id, RPC.BAD_PARAMS, 'tools/call requires { name: string, arguments?: object }');
	}
	const name = params.name;
	// Hard allowlist: the transport refuses any name not in THIS registry. A private tool
	// name submitted to a public registry lands here and is rejected — never dispatched.
	if (!registry.tools.some((tool) => tool.name === name)) {
		return ok(id, {
			content: [{ type: 'text', text: `Unknown tool "${name}". This endpoint does not expose it.` }],
			isError: true,
		});
	}
	try {
		const result = await registry.dispatch(name, params.arguments);
		return ok(id, result);
	} catch (cause) {
		// Error hygiene: never return the raw exception string (it can carry SQL text, internal
		// paths, or deployment details). Log the detail server-side; hand the caller a bounded,
		// generic tool error that names only the tool they invoked.
		console.error(`[mcp] tool '${name}' threw:`, cause);
		return ok(id, {
			content: [{ type: 'text', text: `The "${name}" tool failed to complete. The error was logged server-side.` }],
			isError: true,
		});
	}
}

/**
 * Handle a single parsed JSON-RPC message. Returns the response to serialize, or `null` when
 * the message is a notification (the endpoint should answer 202 with an empty body).
 */
export async function handleMcpMessage(
	parsed: unknown,
	registry: ToolRegistry,
	identity: McpServerIdentity,
): Promise<JsonRpcResponse | null> {
	if (Array.isArray(parsed)) {
		return fail(null, RPC.INVALID_REQ, 'Batch requests are not supported');
	}
	if (!isRecord(parsed)) {
		return fail(null, RPC.INVALID_REQ, 'Invalid Request');
	}
	// Envelope validation — a malformed request must never dispatch a tool.
	if (parsed.jsonrpc !== '2.0') {
		return fail(isValidId(parsed.id) ? parsed.id : null, RPC.INVALID_REQ, 'Invalid Request: jsonrpc must be "2.0"');
	}
	if ('id' in parsed && !isValidId(parsed.id)) {
		return fail(null, RPC.INVALID_REQ, 'Invalid Request: id must be a string, number, or null');
	}
	const msg = parsed as JsonRpcRequest;
	if (typeof msg.method !== 'string' || msg.method.length === 0) {
		return fail(msg.id ?? null, RPC.INVALID_REQ, 'Invalid Request: missing method');
	}
	if (isNotification(msg)) {
		// notifications/initialized and friends: acknowledged with no body.
		return null;
	}
	const id = msg.id ?? null;
	switch (msg.method) {
		case 'initialize':
			return ok(id, {
				protocolVersion: negotiateProtocolVersion(isRecord(msg.params) ? msg.params.protocolVersion : undefined),
				capabilities: { tools: { listChanged: false } },
				serverInfo: { name: identity.name, version: identity.version },
				instructions: identity.instructions,
				...(identity.meta && { _meta: identity.meta }),
			});
		case 'ping':
			return ok(id, {});
		case 'tools/list':
			return ok(id, { tools: registry.tools });
		case 'tools/call':
			return handleToolsCall(msg.params, id, registry);
		default:
			return fail(id, RPC.NO_METHOD, `Method not found: ${msg.method}`);
	}
}
