import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mcpMethodNotAllowed, respondToMcpPost } from './http';
import { publicPatternRegistry } from './patterns/registry';
import type { McpServerIdentity } from './transport';
import { noopMcpObserver } from './types';

/**
 * Protocol-level interoperability proof using the REAL @modelcontextprotocol/sdk client driving
 * a local HTTP adapter that delegates to the SAME `respondToMcpPost` production uses (GET → 405,
 * Origin/protocol guards, envelope validation, dispatch). This exercises the actual initialize
 * handshake, tools/list, and tools/call over HTTP — not a hand-rolled fetch.
 */
const IDENTITY: McpServerIdentity = {
	name: 'v10r-mcp-public',
	version: '0.0.1',
	instructions: 'Hosted read-only pattern MCP (interop test).',
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
	it('initializes and lists exactly the six read-only pattern tools', async () => {
		const { client, transport } = await connectClient();
		try {
			const { tools } = await client.listTools();
			expect(tools.map((t) => t.name).sort()).toEqual(
				[
					'get_file_excerpt',
					'get_pattern',
					'recommend_emulation_plan',
					'search_patterns',
					'trace_capability',
					'validate_snippet',
				].sort(),
			);
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
				arguments: { query: 'stripe subscription webhooks' },
			});
			expect(result.isError).toBe(true);
			expect(result).not.toHaveProperty('diag');
			expect(JSON.stringify(result)).not.toMatch(/diag/);
		} finally {
			await transport.close();
		}
	});
});
