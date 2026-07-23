import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/api/rate-limit', () => ({
	createLimiter: () => ({ limit: async () => ({ success: true, reset: 0 }) }),
	rateLimitResponse: () => new Response('{}', { status: 429 }),
}));

const { GET, POST } = await import('./+server');

type PostEvent = Parameters<typeof POST>[0];
function post(rawBody: string, headers: Record<string, string> = {}) {
	const request = new Request('http://localhost/api/mcp/public', {
		method: 'POST',
		body: rawBody,
		headers: { 'content-type': 'application/json', ...headers },
	});
	return POST({ request, getClientAddress: () => '127.0.0.1' } as unknown as PostEvent);
}
const rpc = (method: string, params?: unknown, id: unknown = 1) =>
	post(JSON.stringify({ jsonrpc: '2.0', id, method, params }));

describe('GET /api/mcp/public', () => {
	it('returns 405 (SSE unsupported) with Allow: POST and no tool metadata', async () => {
		const res = await GET({} as unknown as Parameters<typeof GET>[0]);
		expect(res.status).toBe(405);
		expect(res.headers.get('allow')).toBe('POST');
		const body = await res.json();
		expect(body).not.toHaveProperty('tools');
	});
});

describe('POST /api/mcp/public', () => {
	it('initialize identifies the public server with only coarse version in _meta', async () => {
		const res = await rpc('initialize', { protocolVersion: '2025-06-18' });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.result.serverInfo.name).toBe('v10r-mcp-public');
		expect(body.result._meta).toHaveProperty('app');
		expect(body.result._meta).not.toHaveProperty('commit');
		expect(body.result._meta).not.toHaveProperty('environment');
	});

	it('tools/list returns exactly the five pattern tools', async () => {
		const res = await rpc('tools/list');
		const body = await res.json();
		expect(body.result.tools.map((t: { name: string }) => t.name).sort()).toEqual(
			['get_file_excerpt', 'get_pattern', 'recommend_emulation_plan', 'search_patterns', 'trace_capability'].sort(),
		);
	});

	it('rejects an admin mutation submitted to the public endpoint', async () => {
		const res = await rpc('tools/call', { name: 'set_mcp_page_message', arguments: { message: 'x' } });
		const body = await res.json();
		expect(body.result.isError).toBe(true);
	});

	it('acknowledges a notification with 202 and no body', async () => {
		const res = await post(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }));
		expect(res.status).toBe(202);
	});

	it('returns a 400 JSON-RPC parse error on malformed JSON', async () => {
		const res = await post('this is not json');
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error.code).toBe(-32700);
	});

	it('rejects a cross-origin browser request (DNS-rebinding) with 403', async () => {
		const res = await post(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }), {
			origin: 'http://evil.example',
		});
		expect(res.status).toBe(403);
	});

	it('allows a same-origin request', async () => {
		const res = await post(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }), {
			origin: 'http://localhost',
		});
		expect(res.status).toBe(200);
	});

	it('rejects an unsupported MCP-Protocol-Version header with 400', async () => {
		const res = await post(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }), {
			'mcp-protocol-version': '1999-01-01',
		});
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error.code).toBe('unsupported_protocol_version');
	});

	it('accepts a supported MCP-Protocol-Version header', async () => {
		const res = await post(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }), {
			'mcp-protocol-version': '2025-06-18',
		});
		expect(res.status).toBe(200);
	});
});
