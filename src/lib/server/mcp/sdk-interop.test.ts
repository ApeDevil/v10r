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
import type { McpServerIdentity } from '#mcp/tool-server.ts';
import { mcpMethodNotAllowed, respondToMcpPost } from './http.adapter';
import { publicPatternRegistry } from './patterns/tools';
import { noopMcpObserver, type ToolRegistry } from './types';

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
/** The registry the test server serves; one describe swaps in a throwing wrapper. */
let served: ToolRegistry = publicPatternRegistry;

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
		const response = await respondToMcpPost(request, served, IDENTITY, noopMcpObserver);
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

	it('rejects an admin mutation tool submitted to the public endpoint with the protocol error -32602', async () => {
		const { client, transport } = await connectClient();
		try {
			await expect(
				client.callTool({ name: 'set_mcp_page_message', arguments: { message: 'x' } }),
			).rejects.toMatchObject({ code: -32602 });
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

/**
 * The two 2025-11-25 conformance scenarios v10r baselines — `tools-call-simple-text` and
 * `tools-call-error` — call fixture tools (`test_simple_text`, `test_error_handling`) no
 * production server has a reason to expose. These cases run the SAME assertions those scenarios
 * make, through a real SDK client on the 2025-era handshake, against v10r's own tools — so the
 * baseline entries exclude only the fixture names, never the behaviour.
 */
describe('conformance fixture equivalents on real tools (2025-11-25 era)', () => {
	/** `tools-call-simple-text`: a content array, non-empty, with a text block carrying text. */
	function expectSimpleText(result: Awaited<ReturnType<Client['callTool']>>) {
		const content = result.content as Array<{ type: string; text?: string }>;
		expect(Array.isArray(content)).toBe(true);
		expect(content.length).toBeGreaterThan(0);
		const text = content.find((block) => block.type === 'text');
		expect(text?.text).toBeTruthy();
	}

	/** `tools-call-error`: an in-band result (not a JSON-RPC error) with isError and a message. */
	function expectToolError(result: Awaited<ReturnType<Client['callTool']>>) {
		expect(result.isError).toBe(true);
		const content = result.content as Array<{ type: string; text?: string }>;
		expect(content[0]?.text).toBeTruthy();
	}

	const SUCCESSFUL_CALLS: Array<[string, Record<string, unknown>]> = [
		['search_patterns', { query: 'background jobs' }],
		['get_pattern', { id: 'multi-client-core' }],
		['trace_capability', { capability: 'rag ingest' }],
		['recommend_emulation_plan', { capabilities: ['ai chat', 'design system'] }],
		['validate_snippet', { language: 'svelte', snippet: '<script>\nlet { value } = $props();\n</script>' }],
	];

	it('negotiates the 2025 era', async () => {
		const { client, transport } = await connectClient();
		try {
			expect(transport.protocolVersion).toMatch(/^2025-/);
			expect(client.getServerVersion()?.name).toBe(IDENTITY.name);
		} finally {
			await transport.close();
		}
	});

	for (const [name, args] of SUCCESSFUL_CALLS) {
		it(`tools-call-simple-text ≡ ${name} answers text content without isError`, async () => {
			const { client, transport } = await connectClient();
			try {
				const result = await client.callTool({ name, arguments: args });
				expect(result.isError).toBeFalsy();
				expectSimpleText(result);
			} finally {
				await transport.close();
			}
		});
	}

	const DOMAIN_ERRORS: Array<[string, string, Record<string, unknown>]> = [
		['unknown record', 'get_pattern', { id: 'does-not-exist' }],
		['missing required argument', 'search_patterns', {}],
		['wrong argument type', 'search_patterns', { query: 5 }],
		['file outside the allowlist', 'get_file_excerpt', { path: '../../etc/passwd' }],
	];

	for (const [label, name, args] of DOMAIN_ERRORS) {
		it(`tools-call-error ≡ ${name} (${label}) answers isError with a message`, async () => {
			const { client, transport } = await connectClient();
			try {
				expectToolError(await client.callTool({ name, arguments: args }));
			} finally {
				await transport.close();
			}
		});
	}

	it('tools-call-error ≡ a real tool that throws answers isError with a generic message, no exception text', async () => {
		// The scenario's fixture "always throws". Same here: a real tool whose dispatcher throws.
		served = {
			tools: publicPatternRegistry.tools,
			dispatch: () => {
				throw new Error('SECRET internal detail');
			},
		};
		const { client, transport } = await connectClient();
		try {
			const result = await client.callTool({ name: 'search_patterns', arguments: { query: 'jobs' } });
			expectToolError(result);
			expect(JSON.stringify(result)).not.toMatch(/SECRET/);
		} finally {
			served = publicPatternRegistry;
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

	it('legacy mode: an admin tool on the public endpoint is the protocol error -32602, never dispatched', async () => {
		const { client, transport } = await connectV2('legacy');
		try {
			await expect(
				client.callTool({ name: 'set_mcp_page_message', arguments: { message: 'x' } }),
			).rejects.toMatchObject({ code: -32602 });
		} finally {
			await transport.close();
		}
	});

	it('modern mode: the same call is the same protocol error -32602', async () => {
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
 * The stdio server through the v2 client's own stdio transport: a spawned process, the same shape
 * an MCP client launches — the registered entry (`mcp/server.ts`, which starts the bundle), the source
 * (`mcp/stdio-server.ts`, resolved against node_modules) and the committed self-contained bundle
 * the container runs (`mcp/server.bundle.js`). `bun` is on
 * PATH in both the cloud session and the container.
 */
describe('MCP SDK v2 client interoperability (stdio)', () => {
	async function connectStdio(mode: 'legacy' | 'auto' | { pin: string }, entry: string) {
		const client = new ClientV2({ name: 'interop-test-v2', version: '1.0.0' }, { versionNegotiation: { mode } });
		const transport = new StdioClientTransportV2({ command: 'bun', args: [entry], stderr: 'ignore' });
		await client.connect(transport);
		return client;
	}

	for (const [mode, era, entry] of [
		['legacy', 'legacy', 'mcp/server.ts'],
		['auto', 'modern', 'mcp/server.ts'],
		[{ pin: '2026-07-28' }, 'modern', 'mcp/server.ts'],
		['legacy', 'legacy', 'mcp/stdio-server.ts'],
		['auto', 'modern', 'mcp/stdio-server.ts'],
		['legacy', 'legacy', 'mcp/server.bundle.js'],
		['auto', 'modern', 'mcp/server.bundle.js'],
	] as const) {
		it(`${entry}, ${JSON.stringify(mode)} mode: connects in the ${era} era, lists eight tools and calls one`, async () => {
			const client = await connectStdio(mode, entry);
			try {
				expect(client.getProtocolEra()).toBe(era);
				const { tools } = await client.listTools();
				expect(tools.map((t) => t.name).sort()).toEqual(PATTERN_TOOL_NAMES);
				const result = await client.callTool({ name: 'get_pattern', arguments: { id: 'singleflight' } });
				expect(result.isError).toBeFalsy();
				// Unknown tool: the spec's -32602 protocol error, in either era.
				await expect(
					client.callTool({ name: 'set_mcp_page_message', arguments: { message: 'x' } }),
				).rejects.toMatchObject({ code: -32602 });
			} finally {
				await client.close();
			}
		});
	}
});
