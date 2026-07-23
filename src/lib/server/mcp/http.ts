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
 *  - `MCP-Protocol-Version`, when present, must be a supported version (else 400).
 *  - The JSON body is parsed and envelope-validated by the transport before any dispatch.
 */
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { isSupportedProtocolVersion, SUPPORTED_PROTOCOL_VERSIONS } from './server-info';
import { handleMcpMessage, type McpServerIdentity } from './transport';
import { RPC, type ToolRegistry } from './types';

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

/**
 * Run the shared POST path: Origin + protocol-version guards, JSON parse, then the transport
 * (which validates the JSON-RPC envelope before dispatch). Returns the HTTP Response.
 * Endpoints call this AFTER their own rate-limit / auth.
 */
export async function respondToMcpPost(
	request: Request,
	registry: ToolRegistry,
	identity: McpServerIdentity,
): Promise<Response> {
	if (!isAllowedOrigin(request)) {
		return json({ error: { code: 'forbidden_origin', message: 'Origin not allowed.' } }, { status: 403 });
	}
	if (!protocolVersionHeaderOk(request)) {
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
		return json({ jsonrpc: '2.0', id: null, error: { code: RPC.PARSE, message: 'Parse error' } }, { status: 400 });
	}

	try {
		const response = await handleMcpMessage(parsed, registry, identity);
		if (response === null) return new Response(null, { status: 202 });
		return json(response);
	} catch (cause) {
		// Defence in depth: tool throws are already caught in the transport, but anything else
		// stays a clean JSON-RPC internal error — never a raw 500 / exception string on the wire.
		console.error('[mcp] transport error:', cause);
		return json(
			{ jsonrpc: '2.0', id: null, error: { code: RPC.INTERNAL, message: 'Internal error' } },
			{ status: 500 },
		);
	}
}
