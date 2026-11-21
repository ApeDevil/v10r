import http from 'node:http';
import type { AddressInfo } from 'node:net';
import {
	Client as ClientV2,
	StreamableHTTPClientTransport as StreamableHTTPClientTransportV2,
} from '@modelcontextprotocol/client';
import { StdioClientTransport as StdioClientTransportV2 } from '@modelcontextprotocol/client/stdio';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mcpMethodNotAllowed, respondToMcpPost } from './http.adapter';
import { publicPatternRegistry } from './patterns/tools';
import type { McpServerIdentity } from './transport';
import { noopMcpObserver } from './types';

/**
 * Protocol-level interoperability proof using the REAL MCP SDK clients — v1
 * (`@modelcontextprotocol/sdk`) and v2 (`@modelcontextprotocol/client`) — driving
 * a local HTTP adapter that delegates to the SAME `respondToMcpPost` production uses (GET → 405,
 * Origin/protocol guards, envelope validation, dispatch). This exercises the actual initialize
 * handshake, tools/list, and tools/call over HTTP — not a hand-rolled fetch.
 */
const PATTERN_TOOL_NAMES = [
	'check_architecture',
	'explore_architecture',
	'get_file_excerpt',
	'get_pattern',
	'recommend_emulation_plan',
	'search_patterns',
	'trace_capability',
	'validate_snippet',
];

const IDENTITY: McpServerIdentity = {
	name: 'v10r-mcp-public',
	version: '0.0.1',
	instructions: 'Hosted read-only pattern MCP (interop test).',
	cacheScope: 'public',
};

let server: http.Server;
let baseUrl: URL;

beforeAll(async () => {
	server = http.createServer(async (req, res) => {
		if (req.method !== 'POST') {
			const notAllowed = mcpMethodNotAllowed();
			res.writeHead(notAllowed.status, Object.fromEntries(notAllowed.headers));
			res.end(await notAllowed.text());
			return;
		}
		const chunks: Buffer[] = [];
		for await (const chunk of req) chunks.push(chunk as Buffer);
		const body = Buffer.concat(chunks);
		const headers = new Headers();
		for (const [key, value] of Object.entries(req.headers)) {
			if (typeof value === 'string') headers.set(key, value);
		}
		const request = new Request(`http://${req.headers.host}${req.url}`, {
			method: 'POST',
			headers,
			body: body.length > 0 ? body : undefined,
		});
		const response = await respondToMcpPost(request, publicPatternRegistry, IDENTITY, noopMcpObserver);
		const outHeaders: Record<string, string> = {};
		response.headers.forEach((val, key) => {
			outHeaders[key] = val;
		});
		res.writeHead(response.status, outHeaders);
		res.end(response.body ? await response.text() : undefined);
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address() as AddressInfo;
	baseUrl = new URL(`http://127.0.0.1:${address.port}/api/mcp/public`);
});

afterAll(async () => {
	await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function connectClient() {
	const client = new Client({ name: 'interop-test', version: '1.0.0' });
	const transport = new StreamableHTTPClientTransport(baseUrl);
	await client.connect(transport);
	return { client, transport };
}

describe('MCP SDK interoperability (real client over HTTP)', () => {
	it('initializes and lists exactly the eight read-only pattern tools', async () => {
		const { client, transport } = await connectClient();
		try {
			const { tools } = await client.listTools();
			expect(tools.map((t) => t.name).sort()).toEqual(PATTERN_TOOL_NAMES);
		} finally {
			await transport.close();
		}
	});

	it('calls a read-only tool and gets text content back', async () => {
		const { client, transport } = await connectClient();
		try {
			const result = await client.callTool({ name: 'search_patterns', arguments: { query: 'architecture' } });
			const content = result.content as Array<{ type: string; text: string }>;
			expect(result.isError).toBeFalsy();
			expect(content[0].text).toMatch(/multi-client-core/);
		} finally {
			await transport.close();
		}
	});

	it('rejects an admin mutation tool submitted to the public endpoint', async () => {
		const { client, transport } = await connectClient();
		try {
			const result = await client.callTool({ name: 'set_mcp_page_message', arguments: { message: 'x' } });
			expect(result.isError).toBe(true);
		} finally {
			await transport.close();
		}
	});

	it('does not leak the internal diag field to a real MCP client', async () => {
		// The strongest of the three strip pins: it runs the production path end to end, and would
		// also catch the SDK rejecting an unrecognised field in the result schema.
		const { client, transport } = await connectClient();
		try {
			const result = await client.callTool({
				name: 'search_patterns',
				arguments: { query: 'stripe billing webhooks' },
			});
			expect(result.isError).toBe(true);
			expect(result).not.toHaveProperty('diag');
			expect(JSON.stringify(result)).not.toMatch(/diag/);
		} finally {
			await transport.close();
		}
	});
});

/** One line per POST the v2 client sent: what it asked for and what it got back. */
interface WireExchange {
	method: string | null;
	headerVersion: string | null;
	status: number;
}

async function connectV2(mode: 'legacy' | 'auto' | { pin: string }) {
	const wire: WireExchange[] = [];
	const recordingFetch: typeof fetch = async (input, init) => {
		const response = await fetch(input, init);
		const headers = new Headers(init?.headers);
		let method: string | null = null;
		try {
			method = JSON.parse(String(init?.body)).method ?? null;
		} catch {
			method = null;
		}
		wire.push({ method, headerVersion: headers.get('mcp-protocol-version'), status: response.status });
		return response;
	};
	const client = new ClientV2({ name: 'interop-test-v2', version: '1.0.0' }, { versionNegotiation: { mode } });
	const transport = new StreamableHTTPClientTransportV2(baseUrl, { fetch: recordingFetch });
	await client.connect(transport);
	return { client, transport, wire };
}

/**
 * The v2 client is the modern-era reference implementation. Each negotiation mode is exercised on
 * its own so the legacy path and the modern path are proven independently, not through each other.
 */
describe('MCP SDK v2 client interoperability (HTTP)', () => {
	it('legacy mode: the plain initialize handshake, eight tools, a working call', async () => {
		const { client, transport, wire } = await connectV2('legacy');
		try {
			expect(client.getProtocolEra()).toBe('legacy');
			expect(client.getNegotiatedProtocolVersion()).toBe('2025-11-25');
			expect(wire[0]).toMatchObject({ method: 'initialize', status: 200 });
			const { tools } = await client.listTools();
			expect(tools.map((t) => t.name).sort()).toEqual(PATTERN_TOOL_NAMES);
			const result = await client.callTool({ name: 'get_pattern', arguments: { id: 'singleflight' } });
			expect(result.isError).toBeFalsy();
		} finally {
			await transport.close();
		}
	});

	it('auto mode: the server/discover probe succeeds, so the client stays modern — no initialize, no fallback', async () => {
		const { client, transport, wire } = await connectV2('auto');
		try {
			expect(wire[0]).toEqual({ method: 'server/discover', headerVersion: '2026-07-28', status: 200 });
			expect(wire.some((exchange) => exchange.method === 'initialize')).toBe(false);
			expect(client.getProtocolEra()).toBe('modern');
			expect(client.getNegotiatedProtocolVersion()).toBe('2026-07-28');
			const { tools } = await client.listTools();
			expect(tools.map((t) => t.name).sort()).toEqual(PATTERN_TOOL_NAMES);
			const result = await client.callTool({ name: 'get_pattern', arguments: { id: 'singleflight' } });
			expect(result.isError).toBeFalsy();
			// Every modern request went out under the modern header and was answered 200.
			expect(wire.every((exchange) => exchange.headerVersion === '2026-07-28' && exchange.status === 200)).toBe(true);
		} finally {
			await transport.close();
		}
	});

	it("pin mode: connects at exactly 2026-07-28 and gets the server's instructions from discover", async () => {
		const { client, transport } = await connectV2({ pin: '2026-07-28' });
		try {
			expect(client.getProtocolEra()).toBe('modern');
			expect(client.getInstructions()).toBe(IDENTITY.instructions);
			expect(client.getServerVersion()).toMatchObject({ name: IDENTITY.name });
			const result = await client.callTool({ name: 'search_patterns', arguments: { query: 'architecture' } });
			expect(result.isError).toBeFalsy();
		} finally {
			await transport.close();
		}
	});

	it('legacy mode: an admin tool on the public endpoint is an isError result, never dispatched', async () => {
		const { client, transport } = await connectV2('legacy');
		try {
			const result = await client.callTool({ name: 'set_mcp_page_message', arguments: { message: 'x' } });
			expect(result.isError).toBe(true);
		} finally {
			await transport.close();
		}
	});

	it('modern mode: the same call is the 2026-07-28 protocol error -32602', async () => {
		const { client, transport } = await connectV2({ pin: '2026-07-28' });
		try {
			await expect(
				client.callTool({ name: 'set_mcp_page_message', arguments: { message: 'x' } }),
			).rejects.toMatchObject({ code: -32602 });
		} finally {
			await transport.close();
		}
	});

	it('pin mode fails loudly on a revision the server does not offer', async () => {
		await expect(connectV2({ pin: '2099-01-01' })).rejects.toThrow();
	});
});

/**
 * The stdio server through the v2 client's own stdio transport: a spawned `bun mcp/server.ts`, the
 * same process shape an MCP client launches. `bun` is on PATH in both the cloud session and the
 * container; the server itself needs nothing else.
 */
describe('MCP SDK v2 client interoperability (stdio)', () => {
	async function connectStdio(mode: 'legacy' | 'auto' | { pin: string }) {
		const client = new ClientV2({ name: 'interop-test-v2', version: '1.0.0' }, { versionNegotiation: { mode } });
		const transport = new StdioClientTransportV2({ command: 'bun', args: ['mcp/server.ts'], stderr: 'ignore' });
		await client.connect(transport);
		return client;
	}

	for (const [mode, era] of [
		['legacy', 'legacy'],
		['auto', 'modern'],
		[{ pin: '2026-07-28' }, 'modern'],
	] as const) {
		it(`${JSON.stringify(mode)} mode: connects in the ${era} era, lists eight tools and calls one`, async () => {
			const client = await connectStdio(mode);
			try {
				expect(client.getProtocolEra()).toBe(era);
				const { tools } = await client.listTools();
				expect(tools.map((t) => t.name).sort()).toEqual(PATTERN_TOOL_NAMES);
				const result = await client.callTool({ name: 'get_pattern', arguments: { id: 'singleflight' } });
				expect(result.isError).toBeFalsy();
				// Unknown tool: an isError result on the legacy path, the spec's -32602 on the modern one.
				const unknown = client.callTool({ name: 'set_mcp_page_message', arguments: { message: 'x' } });
				if (era === 'legacy') expect((await unknown).isError).toBe(true);
				else await expect(unknown).rejects.toMatchObject({ code: -32602 });
			} finally {
				await client.close();
			}
		});
	}
});
