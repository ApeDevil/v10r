/**
 * Drive the hosted MCP the way a client does: one JSON-RPC message, POSTed through the production
 * `respondToMcpPost` (so the official SDK answers it), with the headers a spec-conforming
 * Streamable HTTP client sends. Tests that care about the body read `body`; tests about statuses
 * read `status`.
 */

import type { McpServerIdentity } from '#mcp/tool-server.ts';
import { respondToMcpPost } from './http.adapter.ts';
import { type McpCallObserver, noopMcpObserver, type ToolRegistry } from './types.ts';

/** What every Streamable HTTP client must send (the SDK answers 406 without it on the legacy path). */
export const MCP_CLIENT_HEADERS = {
	'content-type': 'application/json',
	accept: 'application/json, text/event-stream',
} as const;

export const TEST_MCP_IDENTITY: McpServerIdentity = {
	name: 'test',
	version: '0.0.1',
	instructions: 'test server',
	cacheScope: 'public',
};

/** The 2026-07-28 request: the `_meta` envelope plus the standard headers that must mirror it. */
export function modernRpc(method: string, params: Record<string, unknown> = {}, version = '2026-07-28') {
	const headers: Record<string, string> = { 'mcp-protocol-version': version, 'mcp-method': method };
	if (method === 'tools/call' && typeof params.name === 'string') headers['mcp-name'] = params.name;
	return {
		message: {
			jsonrpc: '2.0',
			id: 1,
			method,
			params: {
				...params,
				_meta: {
					'io.modelcontextprotocol/protocolVersion': version,
					'io.modelcontextprotocol/clientCapabilities': {},
					'io.modelcontextprotocol/clientInfo': { name: 'test-client', version: '9.9.9' },
				},
			},
		},
		headers,
	};
}

export interface McpPostOptions {
	identity?: McpServerIdentity;
	headers?: Record<string, string | null>;
	observer?: McpCallObserver;
}

export async function mcpPost(
	registry: ToolRegistry,
	message: unknown,
	{ identity = TEST_MCP_IDENTITY, headers = {}, observer = noopMcpObserver }: McpPostOptions = {},
	// biome-ignore lint/suspicious/noExplicitAny: test reads arbitrary JSON-RPC shapes
): Promise<{ status: number; body: any; response: Response }> {
	const merged = new Headers(MCP_CLIENT_HEADERS);
	for (const [key, value] of Object.entries(headers)) {
		if (value === null) merged.delete(key);
		else merged.set(key, value);
	}
	const request = new Request('http://localhost/api/mcp/public', {
		method: 'POST',
		headers: merged,
		body: typeof message === 'string' ? message : JSON.stringify(message),
	});
	const response = await respondToMcpPost(request, registry, identity, observer);
	const text = await response.clone().text();
	return { status: response.status, body: text.length > 0 ? JSON.parse(text) : null, response };
}
