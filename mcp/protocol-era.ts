/**
 * Dual-era MCP request routing, shared by both transports.
 *
 * One endpoint serves two generations of client at once:
 *  - **legacy** (2025-11-25 and earlier): an `initialize` handshake negotiates the revision, then
 *    plain requests follow. Unchanged, byte for byte.
 *  - **modern** (2026-07-28): no handshake and no session. Every request carries its revision and
 *    the client's capabilities in `params._meta`, discovery is the `server/discover` request, and
 *    every result says `resultType: "complete"`.
 *
 * The era is decided per request from the BODY (an envelope claim in `_meta`), the way the
 * official SDK's `classifyRequestBody` does, so a proxy that drops a header cannot change it. The
 * HTTP headers are then checked against the body. Stdio passes `headers: null` — it has none.
 *
 * What this module deliberately does not own: tools. Both transports keep their one registry and
 * their one dispatcher; the era only decides how a request is admitted and how its result is
 * dressed. Zero imports beyond the version list, for the same reason as `protocol-version.ts`.
 */
import { isModernProtocolVersion, MODERN_PROTOCOL_VERSIONS, namesModernEra } from './protocol-version.ts';

/** The reserved per-request `_meta` keys of 2026-07-28. */
export const PROTOCOL_VERSION_META_KEY = 'io.modelcontextprotocol/protocolVersion';
export const CLIENT_CAPABILITIES_META_KEY = 'io.modelcontextprotocol/clientCapabilities';
export const CLIENT_INFO_META_KEY = 'io.modelcontextprotocol/clientInfo';
export const SERVER_INFO_META_KEY = 'io.modelcontextprotocol/serverInfo';

/** The 2026-07-28 error codes (-32020..-32022). JSON-RPC's own codes stay where each transport keeps them. */
export const MODERN_ERROR = {
	HEADER_MISMATCH: -32020,
	MISSING_REQUIRED_CLIENT_CAPABILITY: -32021,
	UNSUPPORTED_PROTOCOL_VERSION: -32022,
} as const;

const INVALID_PARAMS = -32602;
const METHOD_NOT_FOUND = -32601;

/**
 * How long a client may treat `server/discover` and `tools/list` as fresh. The tool list and the
 * instructions only change with a deploy, and the registry version travels in every hosted
 * result, so an hour costs nothing in correctness and saves a `tools/list` on every reconnect.
 */
export const LIST_RESULT_TTL_MS = 3_600_000;

/** The standard request headers of the HTTP transport, as received (null when absent). */
export interface McpStandardHeaders {
	protocolVersion: string | null;
	method: string | null;
	name: string | null;
}

export interface EraError {
	code: number;
	message: string;
	data?: unknown;
}

export interface ClientImplementation {
	name: string;
	version: string;
}

export type EraRoute =
	| { era: 'legacy' }
	| { era: 'modern'; protocolVersion: string; clientInfo: ClientImplementation | null }
	| { era: 'rejected'; httpStatus: number; error: EraError };

/** What a server says about itself on the modern path. */
export interface ModernServerDescription {
	serverInfo: ClientImplementation;
	instructions: string;
	/** `public` when no answer depends on who asks; `private` behind a credential. */
	cacheScope: 'public' | 'private';
	/** Extra result `_meta`, merged under the reserved `serverInfo` key. */
	meta?: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requestMeta(params: unknown): Record<string, unknown> | null {
	return isRecord(params) && isRecord(params._meta) ? params._meta : null;
}

function reject(httpStatus: number, code: number, message: string, data?: unknown): EraRoute {
	return { era: 'rejected', httpStatus, error: { code, message, ...(data !== undefined && { data }) } };
}

function headerMismatch(header: string, body: string): EraRoute {
	return reject(400, MODERN_ERROR.HEADER_MISMATCH, `Bad Request: the request headers and body disagree: ${body}`, {
		mismatch: { header, body },
	});
}

/** First problem with a modern envelope, or null. Missing required keys are reported first. */
function envelopeIssue(meta: Record<string, unknown>): { key: string; problem: string } | null {
	for (const key of [PROTOCOL_VERSION_META_KEY, CLIENT_CAPABILITIES_META_KEY]) {
		if (!(key in meta)) return { key, problem: 'missing' };
	}
	const version = meta[PROTOCOL_VERSION_META_KEY];
	if (typeof version !== 'string' || version.length === 0) {
		return { key: PROTOCOL_VERSION_META_KEY, problem: 'expected a protocol version string' };
	}
	if (!isRecord(meta[CLIENT_CAPABILITIES_META_KEY])) {
		return { key: CLIENT_CAPABILITIES_META_KEY, problem: 'expected an object' };
	}
	if (CLIENT_INFO_META_KEY in meta) {
		const info = meta[CLIENT_INFO_META_KEY];
		if (!isRecord(info) || typeof info.name !== 'string' || typeof info.version !== 'string') {
			return { key: CLIENT_INFO_META_KEY, problem: 'expected { name: string, version: string }' };
		}
	}
	return null;
}

/** Strip RFC 9110 optional whitespace (SP / HTAB) around a field value. */
function stripOws(value: string): string {
	return value.replace(/^[ \t]+|[ \t]+$/g, '');
}

const BASE64_SENTINEL = /^=\?base64\?(.*)\?=$/;
const CANONICAL_BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/**
 * Decode a header value that may carry the `=?base64?…?=` sentinel (how a client sends a name
 * that is not plain ASCII). Undefined when the sentinel is present but its payload is not
 * canonical Base64 of valid UTF-8 — the spec requires rejecting such a value.
 */
function decodeHeaderValue(value: string): string | undefined {
	const sentinel = BASE64_SENTINEL.exec(value);
	if (sentinel === null) return value;
	const payload = sentinel[1] ?? '';
	if (!CANONICAL_BASE64.test(payload)) return undefined;
	try {
		const binary = atob(payload);
		const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		return undefined;
	}
}

/** The body field `Mcp-Name` must mirror, for the methods that have one. */
const MCP_NAME_SOURCE: Record<string, string> = {
	'tools/call': 'name',
	'prompts/get': 'name',
	'resources/read': 'uri',
};

/**
 * The HTTP half of admission for a modern request: `MCP-Protocol-Version` and `Mcp-Method` are
 * required on every request, `Mcp-Name` wherever the method names a target, and each must agree
 * with the body. Runs only on a modern route — legacy traffic never sees these rules.
 */
function standardHeaderIssue(method: string, params: unknown, headers: McpStandardHeaders): EraRoute | null {
	if (headers.protocolVersion === null) {
		return headerMismatch(
			'(missing)',
			'the body carries a modern envelope but the MCP-Protocol-Version header is absent',
		);
	}
	if (headers.method === null) {
		return headerMismatch('(missing)', `the body names method ${method} but the Mcp-Method header is absent`);
	}
	const field = Object.hasOwn(MCP_NAME_SOURCE, method) ? MCP_NAME_SOURCE[method] : undefined;
	if (field === undefined) return null;
	const bodyValue = isRecord(params) && typeof params[field] === 'string' ? (params[field] as string) : undefined;
	if (headers.name === null) {
		if (bodyValue === undefined) return null; // the body itself is malformed; the method answers that
		return headerMismatch(
			'(missing)',
			`the body carries params.${field}="${bodyValue}" but the Mcp-Name header is absent`,
		);
	}
	const normalized = stripOws(headers.name);
	const decoded = decodeHeaderValue(normalized);
	if (decoded === undefined) {
		return headerMismatch(normalized, 'the Mcp-Name header carries an invalid Base64 sentinel value');
	}
	if (bodyValue !== undefined && decoded !== bodyValue) {
		return headerMismatch(
			normalized,
			`the body carries params.${field}="${bodyValue}" but the Mcp-Name header names "${decoded}"`,
		);
	}
	return null;
}

/**
 * Decide which era serves a request, or reject it. The order is the SDK's:
 *
 *  1. `initialize` without a valid modern claim is the legacy handshake — unless the header names
 *     a modern revision, which is a contradiction (-32020).
 *  2. A body that claims an era (`_meta[protocolVersion]` present) is modern: its envelope must be
 *     valid (-32602), and the version and method headers, when present, must match it (-32020).
 *  3. A modern header with no claim in the body is a malformed modern request (-32602), never a
 *     legacy one — a modern client must not be silently downgraded.
 *  4. Everything else is legacy, exactly as before this module existed.
 *
 * A modern route then needs a supported revision (-32022, listing the modern revisions only) and,
 * over HTTP, the standard headers.
 */
export function routeMcpRequest(method: string, params: unknown, headers: McpStandardHeaders | null): EraRoute {
	const meta = requestMeta(params);
	const claimed = meta !== null && PROTOCOL_VERSION_META_KEY in meta;
	const headerVersion = headers?.protocolVersion ?? null;
	const headerNamesModern = headerVersion !== null && namesModernEra(headerVersion);

	if (method === 'initialize' && !(claimed && meta !== null && validModernClaim(meta))) {
		if (headerNamesModern) {
			return headerMismatch(
				headerVersion,
				'an initialize request (legacy handshake) was sent with a modern MCP-Protocol-Version header',
			);
		}
		return { era: 'legacy' };
	}

	if (!claimed || meta === null) {
		if (headerNamesModern) {
			return reject(
				400,
				INVALID_PARAMS,
				`Invalid params: the MCP-Protocol-Version header names protocol revision ${headerVersion}, but the request is missing the required per-request _meta envelope`,
				{ envelope: { missing: meta === null ? ['_meta'] : [PROTOCOL_VERSION_META_KEY] } },
			);
		}
		return { era: 'legacy' };
	}

	const issue = envelopeIssue(meta);
	if (issue !== null) {
		return reject(400, INVALID_PARAMS, `Invalid _meta envelope: ${issue.key}: ${issue.problem}`, { envelope: issue });
	}
	const version = meta[PROTOCOL_VERSION_META_KEY] as string;
	if (headerVersion !== null && headerVersion !== version) {
		return headerMismatch(
			headerVersion,
			`the body envelope names protocol version ${version} but the MCP-Protocol-Version header names ${headerVersion}`,
		);
	}
	if (headers !== null && headers.method !== null && headers.method !== method) {
		return headerMismatch(
			headers.method,
			`the body names method ${method} but the Mcp-Method header names ${headers.method}`,
		);
	}
	if (!isModernProtocolVersion(version)) {
		return reject(400, MODERN_ERROR.UNSUPPORTED_PROTOCOL_VERSION, `Unsupported protocol version: ${version}`, {
			supported: [...MODERN_PROTOCOL_VERSIONS],
			requested: version,
		});
	}
	if (headers !== null) {
		const headerIssue = standardHeaderIssue(method, params, headers);
		if (headerIssue !== null) return headerIssue;
	}
	const info = meta[CLIENT_INFO_META_KEY];
	return {
		era: 'modern',
		protocolVersion: version,
		clientInfo: isRecord(info) ? { name: info.name as string, version: info.version as string } : null,
	};
}

function validModernClaim(meta: Record<string, unknown>): boolean {
	const version = meta[PROTOCOL_VERSION_META_KEY];
	return typeof version === 'string' && namesModernEra(version) && envelopeIssue(meta) === null;
}

/**
 * The modern answer to `tools/call` naming a tool this endpoint does not expose: a protocol error,
 * as 2026-07-28 specifies (an in-band JSON-RPC error, HTTP 200). The legacy era keeps its
 * `isError` result with recovery text — older clients rely on it, and the spec of their era allowed it.
 */
export function modernUnknownTool(name: string): EraError {
	return { code: INVALID_PARAMS, message: `Unknown tool: ${name}`, data: { name } };
}

/** The modern answer to a method this server does not serve — including the legacy-only ones. */
export function modernMethodNotFound(method: string): { httpStatus: number; error: EraError } {
	return { httpStatus: 404, error: { code: METHOD_NOT_FOUND, message: `Method not found: ${method}` } };
}

function resultMeta(server: ModernServerDescription, existing: unknown): Record<string, unknown> {
	return { ...(isRecord(existing) ? existing : {}), ...server.meta, [SERVER_INFO_META_KEY]: server.serverInfo };
}

/** Dress a result for the modern era: `resultType`, the server's identity in `_meta`. */
export function completeResult(result: Record<string, unknown>, server: ModernServerDescription) {
	return { ...result, resultType: 'complete', _meta: resultMeta(server, result._meta) };
}

/** As `completeResult`, plus the caching hints a list result MUST carry. */
export function cacheableResult(result: Record<string, unknown>, server: ModernServerDescription) {
	return { ...completeResult(result, server), ttlMs: LIST_RESULT_TTL_MS, cacheScope: server.cacheScope };
}

/**
 * The `server/discover` result. Its capabilities are the ones `initialize` declares, so the two
 * eras describe the same server: tools only, a static list per deploy.
 */
export function discoverResult(server: ModernServerDescription) {
	return cacheableResult(
		{
			supportedVersions: [...MODERN_PROTOCOL_VERSIONS],
			capabilities: { tools: { listChanged: false } },
			instructions: server.instructions,
		},
		server,
	);
}
