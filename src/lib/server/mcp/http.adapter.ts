/**
 * MCP Streamable HTTP for the public, private and admin endpoints, served by the official SDK.
 *
 * `@modelcontextprotocol/server` owns the protocol: JSON-RPC validation, the legacy `initialize`
 * handshake and version negotiation, the 2026-07-28 per-request envelope, `server/discover`, the
 * `MCP-Protocol-Version` / `Mcp-Method` / `Mcp-Name` checks, the `Accept` / `Content-Type` rules,
 * error codes and HTTP statuses. Each request gets a fresh server from `#mcp/tool-server.ts` — the
 * same factory the stdio server uses — so no state survives between requests and every era is
 * answered from one tool definition.
 *
 * What stays here is what the SDK deliberately leaves to the application:
 *  - **Origin** (DNS-rebinding): same-origin or an explicit allowlist. The SDK's entry is
 *    validation-free by design and says to put this in front of it.
 *  - **The byte budget**: the body is read once under `MAX_MCP_BODY_BYTES` (413 before any parse)
 *    and handed to the SDK pre-parsed, so telemetry and protocol read the same bytes.
 *  - **JSON, never SSE**: legacy requests go through the SDK's stateless transport with
 *    `enableJsonResponse` — the documented hand-wired composition (`isLegacyRequest` in front of a
 *    `legacy: 'reject'` handler) — and modern ones never stream (see `serveModern`). One response
 *    per POST, deterministic and bounded; GET stays 405 (no SSE stream to open).
 *  - **Telemetry**: exactly one observation per POST, read from the request and the JSON answer.
 *  - **One message per POST**: a JSON-RPC batch is refused before the SDK (which would serve it on
 *    the legacy leg). Rate limits count POSTs and telemetry records one call per POST, so a batch
 *    would run N tool calls for the price of one request and leave N-1 of them unrecorded.
 *  - **No subscription streams**: `subscriptions/listen` is answered as a method this server does
 *    not implement (404 / -32601). See `serveModern`.
 *
 * Rate limiting and bearer auth stay in the individual endpoints, before this runs.
 */
import {
	CLIENT_INFO_META_KEY,
	createMcpHandler,
	isLegacyRequest,
	PROTOCOL_VERSION_META_KEY,
	WebStandardStreamableHTTPServerTransport,
} from '@modelcontextprotocol/server';
import { MAX_MCP_BODY_BYTES, payloadTooLargeResponse, readJsonBounded } from '#lib/server/http/body.ts';
// Dependency-free by construction (monitoring/index.ts has zero imports), so this does not pull a
// DB or platform edge into the module graph the zero-mock protocol tests rely on.
import { sanitizeError } from '#lib/server/monitoring/index.ts';
import { createToolServer, type McpServerIdentity, type ToolCallRecord } from '#mcp/tool-server.ts';
import { MCP_ALLOWED_ORIGINS } from '$app/env/private';
import { asToolDiag, type McpCallObservation, type McpCallObserver, RPC, type ToolRegistry } from './types';

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
 *
 * Why not the SDK's `originValidationResponse`: it checks a fixed allowlist, while this policy
 * also admits the deployment's own origin, which differs per Vercel preview.
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

type ServerFactory = () => ReturnType<typeof createToolServer>;

/**
 * The 2026-07-28 leg: the SDK entry, modern-only.
 *
 * - `responseMode` stays the default `auto`: a JSON body unless the handler emits a message before
 *   its result, and the tool server's callbacks never touch the request context, so nothing can be
 *   emitted. (`'json'` would say the same thing and log a warning on every construction.)
 * - `subscriptions/listen` never reaches the entry. The SDK serves it unconditionally, but a listen
 *   stream only ever delivers list-changed and resource-update notifications, and this server
 *   declares `tools.listChanged: false` and no resources — the stream would carry nothing, while on
 *   a serverless function it would hold an instance open until `maxDuration` for every anonymous
 *   caller. Not implementing an optional method is answered the way the spec prescribes for any
 *   method a server does not implement: 404 with -32601 (which the official conformance suite
 *   reports as not applicable). `maxSubscriptions: 0` stays as the second line: should a listen
 *   ever slip past the check, the SDK refuses it in-band instead of opening a stream.
 */
function serveModern(factory: ServerFactory, request: Request, parsedBody: unknown): Promise<Response> {
	const message = asRecord(parsedBody);
	if (message?.method === SUBSCRIPTIONS_LISTEN) {
		const id = typeof message.id === 'string' || typeof message.id === 'number' ? message.id : null;
		return Promise.resolve(
			Response.json(
				{ jsonrpc: '2.0', id, error: { code: RPC.NO_METHOD, message: `Method not found: ${SUBSCRIPTIONS_LISTEN}` } },
				{ status: 404 },
			),
		);
	}
	return createMcpHandler(factory, { legacy: 'reject', maxSubscriptions: 0 }).fetch(request, { parsedBody });
}

const SUBSCRIPTIONS_LISTEN = 'subscriptions/listen';

/**
 * The 2025-era leg: the SDK's stateless Streamable HTTP transport with JSON responses — what its
 * own `legacyStatelessFallback` builds, minus the SSE framing. One server and one transport per
 * request, torn down once the answer exists.
 */
async function serveLegacy(factory: ServerFactory, request: Request, parsedBody: unknown): Promise<Response> {
	const server = factory();
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true,
	});
	await server.connect(transport);
	try {
		return await transport.handleRequest(request, { parsedBody });
	} finally {
		await transport.close().catch(() => {});
		await server.close().catch(() => {});
	}
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

/** The JSON answer the SDK produced, or null when there is none (202, or a non-JSON body). */
async function readAnswer(response: Response): Promise<Record<string, unknown> | null> {
	if (response.status === 202 || !response.headers.get('content-type')?.includes('application/json')) return null;
	try {
		return asRecord(await response.clone().json());
	} catch {
		return null;
	}
}

/**
 * Read the request/response pair. Pure, and the only place that sees both halves: the request
 * body (method, tool, arguments, client identity), the SDK's answer (error code or result), and
 * what the registry itself said (`diag`, which never reaches the wire).
 */
function describeExchange(
	parsed: unknown,
	answer: Record<string, unknown> | null,
	status: number,
	modern: boolean,
	toolCall: ToolCallRecord | null,
): Partial<McpCallObservation> & Pick<McpCallObservation, 'stage' | 'status'> {
	const message = asRecord(parsed);
	const method = asString(message?.method);
	const params = asRecord(message?.params);
	const meta = asRecord(params?._meta);
	const isToolCall = method === 'tools/call';
	const clientInfo = modern
		? asRecord(meta?.[CLIENT_INFO_META_KEY])
		: method === 'initialize'
			? asRecord(params?.clientInfo)
			: null;
	const client = { clientName: asString(clientInfo?.name), clientVersion: asString(clientInfo?.version) };

	if (answer === null) {
		// 202 for a notification is a successful protocol interaction, not an absence of one.
		if (status === 202) return { stage: 'protocol', status, method: 'notification' };
		return { stage: 'envelope', status, method, isError: status >= 400, ...client };
	}

	const error = asRecord(answer.error);
	if (error !== null) {
		const rpcErrorCode = typeof error.code === 'number' ? error.code : null;
		if (isToolCall && status === 200 && toolCall === null && typeof params?.name === 'string') {
			// An in-band -32602 for a tools/call that named a tool this surface does not expose: the
			// tool stage's `unknown_tool` (no diag, never dispatched), in either era.
			return {
				stage: 'tool',
				status,
				method,
				toolName: params.name,
				args: params.arguments,
				isError: true,
				rpcErrorCode,
				...client,
			};
		}
		// -32601 is a well-formed request for a method this server does not serve (protocol stage);
		// anything else was refused at admission, before any dispatch (envelope stage).
		return {
			stage: rpcErrorCode === RPC.NO_METHOD ? 'protocol' : 'envelope',
			status,
			method,
			isError: true,
			rpcErrorCode,
			...client,
		};
	}

	const result = asRecord(answer.result);
	const tools = result && Array.isArray(result.tools) ? result.tools : null;
	const firstBlock = isToolCall && result && Array.isArray(result.content) ? asRecord(result.content[0]) : null;
	const text = asString(firstBlock?.text);
	return {
		stage: isToolCall ? 'tool' : 'protocol',
		status,
		method,
		toolName: isToolCall ? asString(params?.name) : null,
		args: isToolCall ? params?.arguments : undefined,
		isError: result?.isError === true,
		diag: asToolDiag(toolCall?.result?.diag),
		...client,
		servedProtocolVersion: modern
			? asString(meta?.[PROTOCOL_VERSION_META_KEY])
			: method === 'initialize'
				? asString(result?.protocolVersion)
				: null,
		toolCount: tools ? tools.length : null,
		responseText: text === null ? null : text.slice(0, MAX_OBSERVED_RESPONSE_CHARS),
	};
}

/**
 * Serve one MCP POST: Origin guard, bounded body read, then the SDK. Returns the HTTP Response.
 * Endpoints call this AFTER their own rate-limit / auth.
 */
export async function respondToMcpPost(
	request: Request,
	registry: ToolRegistry,
	identity: McpServerIdentity,
	observer: McpCallObserver,
): Promise<Response> {
	const startedAt = performance.now();
	// One helper, every exit — so "exactly one observation per POST" is a property of the shape
	// rather than a discipline each return statement has to remember independently.
	const emit = (partial: Partial<McpCallObservation> & Pick<McpCallObservation, 'stage' | 'status'>) => {
		observer.observe({
			method: null,
			toolName: null,
			diag: null,
			isError: false,
			rpcErrorCode: null,
			clientName: null,
			clientVersion: null,
			requestedProtocolVersion: request.headers.get('mcp-protocol-version'),
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

	/**
	 * Bounded read, because this endpoint is unauthenticated and a JSON-RPC envelope has no
	 * legitimate reason to be large. Oversize is a **413** with the plain `{ error }` shape — the
	 * body never parsed, so there is no request id to echo and no era to answer in. Unparseable
	 * JSON is the JSON-RPC -32700 at 400, right for both eras.
	 */
	const body = await readJsonBounded(request, MAX_MCP_BODY_BYTES);
	if (!body.ok) {
		if (body.reason === 'too_large') {
			emit({ stage: 'envelope', status: 413 });
			return payloadTooLargeResponse(MAX_MCP_BODY_BYTES);
		}
		emit({ stage: 'envelope', status: 400, rpcErrorCode: RPC.PARSE });
		return Response.json(
			{ jsonrpc: '2.0', id: null, error: { code: RPC.PARSE, message: 'Parse error' } },
			{ status: 400 },
		);
	}
	const parsed: unknown = body.value;
	if (Array.isArray(parsed)) {
		emit({ stage: 'envelope', status: 400, isError: true, rpcErrorCode: RPC.INVALID_REQUEST });
		return Response.json(
			{
				jsonrpc: '2.0',
				id: null,
				error: {
					code: RPC.INVALID_REQUEST,
					message: 'Invalid Request: JSON-RPC batches are not accepted. Send one message per POST.',
				},
			},
			{ status: 400 },
		);
	}

	let toolCall: ToolCallRecord | null = null;
	const factory: ServerFactory = () =>
		createToolServer(registry, identity, {
			onToolCall: (record) => {
				toolCall = record;
			},
			// Error hygiene: the cause is logged server-side through sanitizeError, which reads only
			// `err.message` — never the pg DatabaseError's `internalQuery`/`detail` surface.
			onToolError: (name, cause) => console.error(`[mcp] tool '${name}' threw:`, sanitizeError(cause)),
		});

	try {
		const legacy = await isLegacyRequest(request, parsed);
		const response = legacy ? await serveLegacy(factory, request, parsed) : await serveModern(factory, request, parsed);
		emit(describeExchange(parsed, await readAnswer(response), response.status, !legacy, toolCall));
		return response;
	} catch (cause) {
		// Defence in depth: tool throws are already caught in the tool server, but anything else
		// stays a clean JSON-RPC internal error — never a raw 500 / exception string on the wire.
		console.error('[mcp] transport error:', sanitizeError(cause));
		emit({ stage: 'envelope', status: 500, isError: true, rpcErrorCode: RPC.INTERNAL });
		return Response.json(
			{ jsonrpc: '2.0', id: null, error: { code: RPC.INTERNAL, message: 'Internal error' } },
			{ status: 500 },
		);
	}
}
