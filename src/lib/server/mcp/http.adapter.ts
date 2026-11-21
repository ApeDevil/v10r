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
 *  - Dual-era (legacy `initialize` + 2026-07-28 per-request `_meta`): the transport routes each
 *    request by its body, then checks `MCP-Protocol-Version` / `Mcp-Method` / `Mcp-Name` against
 *    it on the modern path. Modern rejections are JSON-RPC errors with the spec's HTTP status
 *    (400 for -32020/-32022/-32602 admission, 404 for an unknown method).
 *  - A header naming a PRE-2026 revision this server does not know still gets the plain
 *    `{ error: { code: 'unsupported_protocol_version' } }` 400 — that caller is a legacy client.
 *  - The JSON body is read under a byte budget, then envelope-validated by the transport before
 *    any dispatch.
 */
import { MAX_MCP_BODY_BYTES, payloadTooLargeResponse, readJsonBounded } from '#lib/server/http/body.ts';
// Dependency-free by construction (monitoring/index.ts has zero imports), so this does not pull a
// DB or platform edge into the module graph the zero-mock protocol tests rely on.
import { sanitizeError } from '#lib/server/monitoring/index.ts';
import type { McpStandardHeaders } from '#mcp/protocol-era.ts';
import { isLegacyProtocolVersion, LEGACY_PROTOCOL_VERSIONS, namesModernEra } from '#mcp/protocol-version.ts';
import { MCP_ALLOWED_ORIGINS } from '$app/env/private';
import { handleMcpMessage, type McpExchange, type McpServerIdentity } from './transport';
import { type JsonRpcResponse, type McpCallObservation, type McpCallObserver, RPC, type ToolRegistry } from './types';

/** 405 for GET (SSE unsupported) — no auth, no tool metadata revealed. */
export function mcpMethodNotAllowed(): Response {
	return Response.json(
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
 *  - the Origin is explicitly listed in MCP_ALLOWED_ORIGINS, which is compared as a FULL origin.
 *
 * Bare-host entries (`app.example`) are normalized to `https://`, never accepted loosely: matching
 * any scheme would let one config line silently admit `http://app.example` too. The operator's
 * intent is preserved, the downgrade is not. `http://localhost` and `http://127.0.0.1` stay
 * expressible by writing the scheme out, which is what a local MCP client actually needs.
 */
function allowedOrigins(): string[] {
	return (MCP_ALLOWED_ORIGINS ?? '')
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0)
		.map((entry) => {
			try {
				// A bare host has no scheme, so URL() rejects it; prefix and retry.
				return new URL(entry.includes('://') ? entry : `https://${entry}`).origin;
			} catch {
				return null;
			}
		})
		.filter((entry): entry is string => entry !== null);
}

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
	// Explicit allowlist: full origin only. Never host-only.
	return allowedOrigins().includes(origin.origin);
}

/**
 * The `MCP-Protocol-Version` header, when present, must be a legacy revision we support or name the
 * modern era. A modern-era value — even one this server does not know — is admitted here and
 * answered by the transport (-32022 lists what is supported), because only the body decides the era.
 */
export function protocolVersionHeaderOk(request: Request): boolean {
	const header = request.headers.get('mcp-protocol-version');
	if (header === null) return true; // absent → legacy `initialize` negotiates, or the modern path rejects
	return isLegacyProtocolVersion(header) || namesModernEra(header);
}

/** The standard request headers the modern path validates against the body. */
function readStandardHeaders(request: Request): McpStandardHeaders {
	return {
		protocolVersion: request.headers.get('mcp-protocol-version'),
		method: request.headers.get('mcp-method'),
		name: request.headers.get('mcp-name'),
	};
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
 * Ceiling on the answer text handed to the observer. The tools already bound their own output
 * (get_file_excerpt caps at 250 lines), so this is not the primary control — it is the guard
 * that stops a FUTURE unbounded tool from parking a large string in a `waitUntil` closure. The
 * persisted ceiling is much lower and lives in the observer, where the policy belongs.
 */
const MAX_OBSERVED_RESPONSE_CHARS = 20_000;

/**
 * Read the request/response pair the transport just completed. Pure, and the ONLY place that knows
 * both halves — which is precisely why this seam sits here rather than inside the transport (too
 * late to see the envelope) or around `registry.dispatch` (too low to see the method at all).
 */
function describeExchange(
	parsed: unknown,
	served: McpExchange,
	response: JsonRpcResponse,
): Partial<McpCallObservation> & Pick<McpCallObservation, 'stage'> {
	const message = asRecord(parsed);
	const method = asString(message?.method);
	const params = asRecord(message?.params);
	const isToolCall = method === 'tools/call';
	const modern = served.era === 'modern';

	if ('error' in response && isToolCall && served.httpStatus === 200 && typeof params?.name === 'string') {
		// The 2026-07-28 unknown-tool answer: an in-band -32602 for a tools/call that named a tool. It is
		// the tool stage's `unknown_tool` (no diag, name not in the registry), exactly like the legacy
		// path's isError result — so the outcome does not depend on the caller's era.
		return {
			stage: 'tool',
			method,
			toolName: params.name,
			args: params.arguments,
			isError: true,
			rpcErrorCode: response.error.code,
			clientName: served.clientInfo?.name ?? null,
			clientVersion: served.clientInfo?.version ?? null,
			servedProtocolVersion: served.modernProtocolVersion,
		};
	}

	if ('error' in response) {
		// -32601 is a well-formed request for a method this server does not serve (protocol stage);
		// anything else was refused at admission, before any dispatch (envelope stage).
		const stage = response.error.code === RPC.NO_METHOD ? 'protocol' : 'envelope';
		return {
			stage,
			method,
			isError: true,
			rpcErrorCode: response.error.code,
			clientName: served.clientInfo?.name ?? null,
			clientVersion: served.clientInfo?.version ?? null,
			servedProtocolVersion: served.modernProtocolVersion,
		};
	}

	const result = asRecord(response.result);
	const clientInfo = modern ? served.clientInfo : method === 'initialize' ? asRecord(params?.clientInfo) : null;
	const tools = result && Array.isArray(result.tools) ? result.tools : null;
	// The tool's answer — first text block of a tools/call result. Read here (before `toWire`
	// runs, though `toWire` is non-mutating so the order could not matter anyway) because this is
	// the only frame that holds the full response. Never populated for tools/list or initialize:
	// their results are protocol metadata, not answers.
	const firstBlock = isToolCall && result && Array.isArray(result.content) ? asRecord(result.content[0]) : null;
	const answer = asString(firstBlock?.text);

	return {
		stage: isToolCall ? 'tool' : 'protocol',
		method,
		toolName: isToolCall ? asString(params?.name) : null,
		// Authoritative source is the body. On the modern path `Mcp-Name` is checked against it before
		// dispatch; on the legacy path the header is not required, so the body stays the one source.
		args: isToolCall ? params?.arguments : undefined,
		isError: result?.isError === true,
		diag: (result?.diag as McpCallObservation['diag']) ?? null,
		clientName: asString(clientInfo?.name),
		clientVersion: asString(clientInfo?.version),
		servedProtocolVersion: modern
			? served.modernProtocolVersion
			: method === 'initialize'
				? asString(result?.protocolVersion)
				: null,
		toolCount: tools ? tools.length : null,
		responseText: answer === null ? null : answer.slice(0, MAX_OBSERVED_RESPONSE_CHARS),
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
	// One helper, seven exits — so "exactly one observation per POST" is a property of the shape
	// rather than a discipline seven return statements have to remember independently.
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
			responseText: null,
			handleMs: Math.round(performance.now() - startedAt),
			...partial,
		});
	};

	if (!isAllowedOrigin(request)) {
		emit({ stage: 'envelope', status: 403 });
		return Response.json({ error: { code: 'forbidden_origin', message: 'Origin not allowed.' } }, { status: 403 });
	}
	if (!protocolVersionHeaderOk(request)) {
		/**
		 * A header naming a pre-2026 revision this server does not know: the caller is a legacy
		 * client, so it gets the plain (non-JSON-RPC) 400 it always got. Modern-era values never
		 * reach this exit — they are routed by the body and answered with JSON-RPC errors.
		 *
		 * History, because the shape was once load-bearing: before this server spoke 2026-07-28, this
		 * 400 also caught every modern probe, and its non-JSON-RPC body is what told modern-first
		 * clients to fall back to `initialize`. A -32022 here would have told them the server was
		 * modern while it was not. That hazard ended when the modern path (server/discover, `_meta`
		 * validation, header checks) shipped as one change; the SDK v2 interop tests now pin both
		 * the modern connection and the legacy fallback.
		 */
		emit({ stage: 'envelope', status: 400 });
		return Response.json(
			{
				error: {
					code: 'unsupported_protocol_version',
					message: `Unsupported MCP-Protocol-Version. Supported: ${LEGACY_PROTOCOL_VERSIONS.join(', ')}.`,
				},
			},
			{ status: 400 },
		);
	}

	/**
	 * Bounded read, because this endpoint is unauthenticated and a JSON-RPC envelope has no
	 * legitimate reason to be large. Note this REPLACES the parse rather than preceding it:
	 * measuring the stream consumes it, so a size check followed by `request.json()` would throw
	 * on the second read.
	 *
	 * Oversize is a **413** with the plain `{ error: { code, message } }` shape — the same as the
	 * 403 two exits up: the body never parsed, so there is no request id to echo and no era to
	 * answer in.
	 */
	const body = await readJsonBounded(request, MAX_MCP_BODY_BYTES);
	if (!body.ok) {
		if (body.reason === 'too_large') {
			emit({ stage: 'envelope', status: 413 });
			return payloadTooLargeResponse(MAX_MCP_BODY_BYTES);
		}
		// Unparseable JSON has no era: the JSON-RPC -32700 at 400 is right for both.
		emit({ stage: 'envelope', status: 400, rpcErrorCode: RPC.PARSE });
		return Response.json(
			{ jsonrpc: '2.0', id: null, error: { code: RPC.PARSE, message: 'Parse error' } },
			{ status: 400 },
		);
	}
	const parsed: unknown = body.value;

	try {
		const served = await handleMcpMessage(parsed, registry, identity, readStandardHeaders(request));
		const response = served.response;
		if (response === null) {
			// A notification is a successful protocol interaction, not an absence of one.
			emit({ stage: 'protocol', status: 202, method: 'notification' });
			return new Response(null, { status: 202 });
		}
		emit({ ...describeExchange(parsed, served, response), status: served.httpStatus });
		return Response.json(toWire(response), { status: served.httpStatus });
	} catch (cause) {
		// Defence in depth: tool throws are already caught in the transport, but anything else
		// stays a clean JSON-RPC internal error — never a raw 500 / exception string on the wire.
		console.error('[mcp] transport error:', sanitizeError(cause));
		emit({ stage: 'envelope', status: 500, isError: true, rpcErrorCode: RPC.INTERNAL });
		return Response.json(
			{ jsonrpc: '2.0', id: null, error: { code: RPC.INTERNAL, message: 'Internal error' } },
			{ status: 500 },
		);
	}
}
