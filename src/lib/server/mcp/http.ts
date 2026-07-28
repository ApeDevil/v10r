/**
 * HTTP-layer glue for the MCP Streamable HTTP transport, shared by the public and admin
 * endpoints (and by the SDK-interop test's local adapter, so the test exercises the SAME code
 * production uses). Concerns here are strictly protocol/transport — rate limiting and bearer
 * auth stay in the individual endpoints.
 *
 * Standards handled:
 *  - GET is the optional server→client SSE channel. We do not implement SSE, so GET → 405.
 *  - `Origin` is validated to block DNS-rebinding; a request with no Origin (a non-browser MCP
 *    client) is allowed, an exact same-origin browser request (scheme + host + port) is allowed,
 *    anything else is rejected unless explicitly allowlisted via MCP_ALLOWED_ORIGINS.
 *  - `MCP-Protocol-Version`, when present, must be a supported version (else 400). ⚠ The SHAPE of
 *    that 400's body is load-bearing for forward compatibility — see the guard in
 *    `respondToMcpPost` before changing it.
 *  - The JSON body is parsed and envelope-validated by the transport before any dispatch.
 *
 * RULE for any future 400 added to this endpoint: use the plain `{ error: { code: '…' } }` shape,
 * NOT a JSON-RPC error envelope. Newer-protocol clients branch on exactly that distinction to
 * decide whether to fall back (see the guard comment below). Note this is a rule, not yet a
 * property of the file: the parse-error path already emits a real JSON-RPC `-32700` at 400.
 */
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
// Dependency-free by construction (monitoring/index.ts has zero imports), so this does not pull a
// DB or platform edge into the module graph the zero-mock protocol tests rely on.
import { sanitizeError } from '$lib/server/monitoring';
import { isSupportedProtocolVersion, SUPPORTED_PROTOCOL_VERSIONS } from './server-info';
import { handleMcpMessage, type McpServerIdentity } from './transport';
import { type JsonRpcResponse, type McpCallObservation, type McpCallObserver, RPC, type ToolRegistry } from './types';

/** 405 for GET (SSE unsupported) — no auth, no tool metadata revealed. */
export function mcpMethodNotAllowed(): Response {
	return json(
		{ error: { code: 'method_not_allowed', message: 'This MCP endpoint accepts POST only (SSE is not supported).' } },
		{ status: 405, headers: { Allow: 'POST' } },
	);
}

/**
 * DNS-rebinding protection. Allow when:
 *  - no Origin header (non-browser MCP client), or
 *  - the Origin's FULL origin (scheme + host + port) equals this request's origin. Comparing the
 *    full origin — not just the host — means a cross-scheme same-host request is rejected: an
 *    `http://` Origin can never pass for an `https://` request URL (that is not same-origin), or
 *  - the Origin is explicitly listed in MCP_ALLOWED_ORIGINS. An allowlist entry may be a full
 *    origin (scheme-pinned, e.g. `https://app.example`) or a bare host (e.g. `app.example`, which
 *    matches ANY scheme for that host). The bare-host / any-scheme behavior is intentional and
 *    applies ONLY to explicit allowlist entries, never to the implicit same-origin check.
 */
export function isAllowedOrigin(request: Request): boolean {
	const originHeader = request.headers.get('origin');
	if (originHeader === null) return true; // non-browser MCP clients legitimately omit Origin
	let origin: URL;
	try {
		origin = new URL(originHeader);
	} catch {
		return false; // malformed / opaque ("null") Origin
	}
	let selfOrigin: string | null = null;
	try {
		selfOrigin = new URL(request.url).origin;
	} catch {
		selfOrigin = null;
	}
	// Implicit same-origin: full origin (scheme + host + port), never host-only.
	if (selfOrigin !== null && origin.origin === selfOrigin) return true;
	const allowed = (env.MCP_ALLOWED_ORIGINS ?? '')
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
	// Explicit allowlist only: full origin (scheme-pinned) OR bare host (any scheme).
	return allowed.includes(origin.origin) || allowed.includes(origin.host);
}

/** The `MCP-Protocol-Version` header, when present, must be a version we support. */
export function protocolVersionHeaderOk(request: Request): boolean {
	const header = request.headers.get('mcp-protocol-version');
	if (header === null) return true; // absent → default negotiated in the initialize body
	return isSupportedProtocolVersion(header);
}

/** The version the caller ASKED for, readable before any parse (and on a rejected request). */
function readRequestedProtocolVersion(request: Request): string | null {
	return request.headers.get('mcp-protocol-version');
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function asString(value: unknown): string | null {
	return typeof value === 'string' ? value : null;
}

/**
 * Read the request/response pair the transport just completed. Pure, and the ONLY place that knows
 * both halves — which is precisely why this seam sits here rather than inside the transport (too
 * late to see the envelope) or around `registry.dispatch` (too low to see the method at all).
 */
function describeExchange(
	parsed: unknown,
	response: JsonRpcResponse,
): Partial<McpCallObservation> & Pick<McpCallObservation, 'stage'> {
	const message = asRecord(parsed);
	const method = asString(message?.method);
	const params = asRecord(message?.params);
	const isToolCall = method === 'tools/call';

	if ('error' in response) {
		// A malformed envelope: the transport rejected it before any dispatch.
		return { stage: 'envelope', method, isError: true, rpcErrorCode: response.error.code };
	}

	const result = asRecord(response.result);
	const clientInfo = method === 'initialize' ? asRecord(params?.clientInfo) : null;
	const tools = result && Array.isArray(result.tools) ? result.tools : null;

	return {
		stage: isToolCall ? 'tool' : 'protocol',
		method,
		toolName: isToolCall ? asString(params?.name) : null,
		// Authoritative source is the body. `Mcp-Name` is untrusted until header/body agreement is
		// enforced, which this server does not yet do.
		args: isToolCall ? params?.arguments : undefined,
		isError: result?.isError === true,
		diag: (result?.diag as McpCallObservation['diag']) ?? null,
		clientName: asString(clientInfo?.name),
		clientVersion: asString(clientInfo?.version),
		servedProtocolVersion: method === 'initialize' ? asString(result?.protocolVersion) : null,
		toolCount: tools ? tools.length : null,
	};
}

/**
 * Strip the internal `diag` before serialization. `diag` is telemetry, not protocol — the wire
 * contract is byte-identical with and without it.
 *
 * Non-mutating, and it returns the SAME reference when there is nothing to strip: the success path
 * allocates nothing, and read-order versus strip-order cannot matter (an ordering bug here would
 * otherwise be invisible). A tempting alternative — making `diag` non-enumerable so JSON.stringify
 * skips it and no strip step exists to forget — was rejected: any future `{...result}` or
 * `structuredClone` would silently zero the telemetry with no test failure, and a loud failure
 * beats a silent one.
 */
function toWire(response: JsonRpcResponse): JsonRpcResponse {
	if (!('result' in response)) return response;
	const result = response.result;
	if (typeof result !== 'object' || result === null || !('diag' in result)) return response;
	const { diag: _diag, ...rest } = result as Record<string, unknown>;
	return { ...response, result: rest };
}

/**
 * Run the shared POST path: Origin + protocol-version guards, JSON parse, then the transport
 * (which validates the JSON-RPC envelope before dispatch). Returns the HTTP Response.
 * Endpoints call this AFTER their own rate-limit / auth.
 */
export async function respondToMcpPost(
	request: Request,
	registry: ToolRegistry,
	identity: McpServerIdentity,
	observer: McpCallObserver,
): Promise<Response> {
	const startedAt = performance.now();
	// One helper, six exits — so "exactly one observation per POST" is a property of the shape
	// rather than a discipline six return statements have to remember independently.
	const emit = (partial: Partial<McpCallObservation> & Pick<McpCallObservation, 'stage' | 'status'>) => {
		observer.observe({
			method: null,
			toolName: null,
			diag: null,
			isError: false,
			rpcErrorCode: null,
			clientName: null,
			clientVersion: null,
			requestedProtocolVersion: readRequestedProtocolVersion(request),
			servedProtocolVersion: null,
			toolCount: null,
			args: undefined,
			handleMs: Math.round(performance.now() - startedAt),
			...partial,
		});
	};

	if (!isAllowedOrigin(request)) {
		emit({ stage: 'envelope', status: 403 });
		return json({ error: { code: 'forbidden_origin', message: 'Origin not allowed.' } }, { status: 403 });
	}
	if (!protocolVersionHeaderOk(request)) {
		/**
		 * ⚠ DO NOT "align" this body to a JSON-RPC error, and in particular do not emit -32022
		 * (UnsupportedProtocolVersion) or any code in the -32020..-32099 range.
		 *
		 * Newer-revision clients probe modern-first and, on a 400, inspect the body to decide what to
		 * do: a recognised modern JSON-RPC error means "this server is modern, retry with one of its
		 * advertised versions"; anything else means "fall back to `initialize`". This server
		 * implements `initialize` and does NOT implement the newer revision, so the non-JSON-RPC
		 * shape below is exactly what keeps those clients working. Emitting -32022 would tell them we
		 * are modern, they would never fall back, and a working connection would become a permanent
		 * failure.
		 *
		 * It is also self-concealing: that change drives recovery-`initialize` volume to zero while
		 * the 400 count stays flat, which on the usage dashboard is indistinguishable from "nobody is
		 * migrating". The landmine disables the one instrument that would catch it.
		 *
		 * UNBLOCK CONDITION — change this ONLY together with all of:
		 *   1. adding the new revision to SUPPORTED_PROTOCOL_VERSIONS (server-info.ts),
		 *   2. implementing the `server/discover` method,
		 *   3. validating the per-request `_meta` envelope the new revision requires.
		 * Partial adoption is worse than none: it trades a spec-defined recovery path for untested
		 * conformance.
		 *
		 * https://modelcontextprotocol.io/specification/draft/basic/transports/streamable-http#backward-compatibility
		 */
		emit({ stage: 'envelope', status: 400 });
		return json(
			{
				error: {
					code: 'unsupported_protocol_version',
					message: `Unsupported MCP-Protocol-Version. Supported: ${SUPPORTED_PROTOCOL_VERSIONS.join(', ')}.`,
				},
			},
			{ status: 400 },
		);
	}

	let parsed: unknown;
	try {
		parsed = await request.json();
	} catch {
		emit({ stage: 'envelope', status: 400, rpcErrorCode: RPC.PARSE });
		return json({ jsonrpc: '2.0', id: null, error: { code: RPC.PARSE, message: 'Parse error' } }, { status: 400 });
	}

	try {
		const response = await handleMcpMessage(parsed, registry, identity);
		if (response === null) {
			// A notification is a successful protocol interaction, not an absence of one.
			emit({ stage: 'protocol', status: 202, method: 'notification' });
			return new Response(null, { status: 202 });
		}
		emit({ ...describeExchange(parsed, response), status: 200 });
		return json(toWire(response));
	} catch (cause) {
		// Defence in depth: tool throws are already caught in the transport, but anything else
		// stays a clean JSON-RPC internal error — never a raw 500 / exception string on the wire.
		console.error('[mcp] transport error:', sanitizeError(cause));
		emit({ stage: 'envelope', status: 500, isError: true, rpcErrorCode: RPC.INTERNAL });
		return json(
			{ jsonrpc: '2.0', id: null, error: { code: RPC.INTERNAL, message: 'Internal error' } },
			{ status: 500 },
		);
	}
}
