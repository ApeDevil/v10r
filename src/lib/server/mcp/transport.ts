/**
 * Framework-free MCP-over-HTTP dispatch, shared by the public, private and admin endpoints.
 *
 * One JSON-RPC message per POST → one JSON-RPC response (or nothing, for notifications).
 * Dual-era: each request is routed to the legacy (`initialize`-negotiated) or the modern
 * (2026-07-28, per-request `_meta`) path by `#mcp/protocol-era.ts`, which the stdio server shares.
 * The two paths differ only in admission and in how a result is dressed — both dispatch through
 * the one registry handed in.
 * This is the non-streaming variant of MCP Streamable HTTP: deterministic, bounded, and it
 * never throws to the wire — a tool that blows up comes back as an `isError` result.
 *
 * The transport is trust-agnostic: it dispatches ONLY names present in the supplied
 * registry's `tools`, so the same code enforces the public/admin separation just by being
 * handed a different registry.
 */

import { sanitizeError } from '#lib/server/monitoring/index.ts';
import {
	type ClientImplementation,
	cacheableResult,
	completeResult,
	discoverResult,
	type McpStandardHeaders,
	type ModernServerDescription,
	modernMethodNotFound,
	modernUnknownTool,
	routeMcpRequest,
} from '#mcp/protocol-era.ts';
import { negotiateLegacyProtocolVersion } from '#mcp/protocol-version.ts';
import { type JsonRpcId, type JsonRpcRequest, type JsonRpcResponse, RPC, type ToolRegistry } from './types';

export interface McpServerIdentity {
	/** Server name reported in `serverInfo`, e.g. "v10r-mcp-public". */
	name: string;
	/** Server version reported in `serverInfo`. */
	version: string;
	/** Human/agent-facing usage guidance returned by `initialize`. */
	instructions: string;
	/** Optional extra metadata merged into the `initialize` result under `_meta` (and every modern result's). */
	meta?: Record<string, unknown>;
	/**
	 * The modern-era cache scope of list results: `public` when no answer depends on who asks,
	 * `private` behind a credential (a shared cache must not serve it across tokens).
	 */
	cacheScope: 'public' | 'private';
}

/** One handled message: the response (null for a notification), the HTTP status, and the era that served it. */
export interface McpExchange {
	response: JsonRpcResponse | null;
	httpStatus: number;
	era: 'legacy' | 'modern' | null;
	/** The revision a modern request was served at; null on the legacy path (`initialize` says it there). */
	modernProtocolVersion: string | null;
	/** Modern `_meta` clientInfo — self-reported, never a security input. */
	clientInfo: ClientImplementation | null;
}

function ok(id: JsonRpcId, result: unknown): JsonRpcResponse {
	return { jsonrpc: '2.0', id, result };
}

function fail(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcResponse {
	return { jsonrpc: '2.0', id, error: { code, message, ...(data !== undefined && { data }) } };
}

function exchange(response: JsonRpcResponse | null, httpStatus = 200): McpExchange {
	return { response, httpStatus, era: null, modernProtocolVersion: null, clientInfo: null };
}

function describeServer(identity: McpServerIdentity): ModernServerDescription {
	return {
		serverInfo: { name: identity.name, version: identity.version },
		instructions: identity.instructions,
		cacheScope: identity.cacheScope,
		...(identity.meta && { meta: identity.meta }),
	};
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
		// Deliberately carries NO `diag` — see ToolDiag. The recorder distinguishes transport-built
		// errors from handler-built ones precisely by that absence, so do not "complete" this literal.
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
		// sanitizeError reads only `err.message`, discarding the enumerable-property surface that
		// `util.inspect` would otherwise print at depth 2 — which on the admin path can include
		// a pg DatabaseError's `internalQuery`/`where` (SQL text) and `detail` (offending row values).
		console.error(`[mcp] tool '${name}' threw:`, sanitizeError(cause));
		// Also deliberately carries no `diag` — the transport built this, not a handler.
		return ok(id, {
			content: [{ type: 'text', text: `The "${name}" tool failed to complete. The error was logged server-side.` }],
			isError: true,
		});
	}
}

/**
 * Handle a single parsed JSON-RPC message. `headers` are the HTTP standard headers (null when the
 * caller has none, as in a unit test); they are only consulted to route and admit modern requests.
 * A notification yields a null response — the endpoint answers 202 with an empty body.
 */
export async function handleMcpMessage(
	parsed: unknown,
	registry: ToolRegistry,
	identity: McpServerIdentity,
	headers: McpStandardHeaders | null = null,
): Promise<McpExchange> {
	if (Array.isArray(parsed)) {
		return exchange(fail(null, RPC.INVALID_REQ, 'Batch requests are not supported'));
	}
	if (!isRecord(parsed)) {
		return exchange(fail(null, RPC.INVALID_REQ, 'Invalid Request'));
	}
	// Envelope validation — a malformed request must never dispatch a tool.
	if (parsed.jsonrpc !== '2.0') {
		return exchange(
			fail(isValidId(parsed.id) ? parsed.id : null, RPC.INVALID_REQ, 'Invalid Request: jsonrpc must be "2.0"'),
		);
	}
	if ('id' in parsed && !isValidId(parsed.id)) {
		return exchange(fail(null, RPC.INVALID_REQ, 'Invalid Request: id must be a string, number, or null'));
	}
	const msg = parsed as JsonRpcRequest;
	if (typeof msg.method !== 'string' || msg.method.length === 0) {
		return exchange(fail(msg.id ?? null, RPC.INVALID_REQ, 'Invalid Request: missing method'));
	}
	if (isNotification(msg)) {
		// notifications/initialized and friends, in either era: acknowledged with no body.
		return exchange(null, 202);
	}
	const id = msg.id ?? null;
	const route = routeMcpRequest(msg.method, msg.params, headers);
	if (route.era === 'rejected') {
		return exchange(fail(id, route.error.code, route.error.message, route.error.data), route.httpStatus);
	}
	if (route.era === 'modern') {
		const served = await answerModern(msg.method, msg.params, id, registry, describeServer(identity));
		return { ...served, era: 'modern', modernProtocolVersion: route.protocolVersion, clientInfo: route.clientInfo };
	}
	return { ...exchange(await answerLegacy(msg.method, msg.params, id, registry, identity)), era: 'legacy' };
}

/** The 2025-era methods, unchanged. */
async function answerLegacy(
	method: string,
	params: unknown,
	id: JsonRpcId,
	registry: ToolRegistry,
	identity: McpServerIdentity,
): Promise<JsonRpcResponse> {
	switch (method) {
		case 'initialize':
			return ok(id, {
				protocolVersion: negotiateLegacyProtocolVersion(isRecord(params) ? params.protocolVersion : undefined),
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
			return handleToolsCall(params, id, registry);
		default:
			return fail(id, RPC.NO_METHOD, `Method not found: ${method}`);
	}
}

/**
 * The 2026-07-28 methods. `initialize`, `ping` and the other removed methods are simply absent, so
 * they answer 404 / -32601 like any method this server does not serve. A tool-call error stays an
 * in-band result at HTTP 200, and an unknown tool is the spec's in-band -32602 (the legacy path keeps
 * its `isError` result with recovery text).
 */
async function answerModern(
	method: string,
	params: unknown,
	id: JsonRpcId,
	registry: ToolRegistry,
	server: ModernServerDescription,
): Promise<Pick<McpExchange, 'response' | 'httpStatus'>> {
	switch (method) {
		case 'server/discover':
			return { response: ok(id, discoverResult(server)), httpStatus: 200 };
		case 'tools/list':
			return { response: ok(id, cacheableResult({ tools: registry.tools }, server)), httpStatus: 200 };
		case 'tools/call': {
			// Same hard allowlist as the legacy path, answered the 2026-07-28 way: an unknown name is a
			// protocol error, never dispatched.
			if (isRecord(params) && typeof params.name === 'string' && !registry.tools.some((t) => t.name === params.name)) {
				const unknown = modernUnknownTool(params.name);
				return { response: fail(id, unknown.code, unknown.message, unknown.data), httpStatus: 200 };
			}
			const response = await handleToolsCall(params, id, registry);
			if (!('result' in response)) return { response, httpStatus: 200 };
			return { response: ok(id, completeResult(response.result as Record<string, unknown>, server)), httpStatus: 200 };
		}
		default: {
			const notFound = modernMethodNotFound(method);
			return { response: fail(id, notFound.error.code, notFound.error.message), httpStatus: notFound.httpStatus };
		}
	}
}
