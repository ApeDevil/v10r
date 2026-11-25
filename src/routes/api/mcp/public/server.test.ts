import { describe, expect, it, vi } from 'vitest';

const limiterState = vi.hoisted(() => ({ success: true }));
vi.mock('#lib/server/http/rate-limit.ts', () => ({
	createLimiter: () => ({ limit: async () => ({ success: limiterState.success, reset: 0 }) }),
	rateLimitResponse: () => new Response('{}', { status: 429 }),
}));

/**
 * Mock the telemetry SEAM, not the database.
 *
 * Because `vi.mock` is hoisted above the dynamic import below, this keeps `#lib/server/db/index.ts` out of
 * this file's module graph ENTIRELY — the route no longer reaches the module that constructs a Neon
 * pool at load. Mocking `#lib/server/db/index.ts` instead would work, but it would let the DB edge into the
 * graph and then neutralise it, which is strictly weaker.
 */
const telemetry = vi.hoisted(() => ({ observed: [] as unknown[], gateRejections: [] as unknown[] }));
vi.mock('#lib/server/mcp/telemetry/observer.ts', () => ({
	createMcpObserver: () => ({ observe: (o: unknown) => telemetry.observed.push(o) }),
	recordMcpGateRejection: (...args: unknown[]) => telemetry.gateRejections.push(args),
}));

const { GET, POST } = await import('./+server');

type PostEvent = Parameters<typeof POST>[0];
function post(rawBody: string, headers: Record<string, string> = {}) {
	const request = new Request('http://localhost/api/mcp/public', {
		method: 'POST',
		body: rawBody,
		headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers },
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
	it('initialize identifies the public server', async () => {
		const res = await rpc('initialize', {
			protocolVersion: '2025-06-18',
			capabilities: {},
			clientInfo: { name: 't', version: '1' },
		});
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.result.serverInfo.name).toBe('v10r-mcp-public');
	});

	it('every tool result carries only the coarse build identity in _meta', async () => {
		const res = await rpc('tools/call', { name: 'search_patterns', arguments: { query: '*' } });
		const body = await res.json();
		expect(body.result._meta).toHaveProperty('app');
		expect(body.result._meta).toHaveProperty('patternRegistry');
		expect(body.result._meta).not.toHaveProperty('commit');
		expect(body.result._meta).not.toHaveProperty('environment');
	});

	it('tools/list returns exactly the eight pattern tools and the explorer App', async () => {
		const res = await rpc('tools/list');
		const body = await res.json();
		expect(body.result.tools.map((t: { name: string }) => t.name).sort()).toEqual(
			[
				'check_architecture',
				'explore_architecture',
				'explore_patterns',
				'get_file_excerpt',
				'get_pattern',
				'recommend_emulation_plan',
				'search_patterns',
				'trace_capability',
				'validate_snippet',
			].sort(),
		);
	});

	describe('the pattern explorer MCP App', () => {
		const VIEW_URI = 'ui://v10r/pattern-explorer.html';

		it('links explore_patterns to its View and leaves every other tool definition bare (B1)', async () => {
			const body = await (await rpc('tools/list')).json();
			const tools = body.result.tools as Array<Record<string, unknown>>;
			for (const tool of tools) {
				// B1: no title, annotations or outputSchema on any tool until the compat run says so.
				expect(tool, String(tool.name)).not.toHaveProperty('title');
				expect(tool, String(tool.name)).not.toHaveProperty('annotations');
				expect(tool, String(tool.name)).not.toHaveProperty('outputSchema');
				if (tool.name !== 'explore_patterns') expect(tool, String(tool.name)).not.toHaveProperty('_meta');
			}
			const explorer = tools.find((tool) => tool.name === 'explore_patterns');
			expect(explorer?._meta).toEqual({ ui: { resourceUri: VIEW_URI }, 'ui/resourceUri': VIEW_URI });
		});

		it('declares resources without list-change notifications', async () => {
			const body = await (
				await rpc('initialize', {
					protocolVersion: '2025-06-18',
					capabilities: {},
					clientInfo: { name: 't', version: '1' },
				})
			).json();
			expect(body.result.capabilities.resources).toEqual({ listChanged: false });
		});

		it('lists the View as a ui:// resource with the MCP Apps MIME type and its CSP', async () => {
			const body = await (await rpc('resources/list')).json();
			expect(body.result.resources).toEqual([
				expect.objectContaining({
					uri: VIEW_URI,
					mimeType: 'text/html;profile=mcp-app',
					_meta: {
						ui: {
							csp: { connectDomains: [], resourceDomains: [], frameDomains: [], baseUriDomains: [] },
							permissions: {},
							prefersBorder: true,
						},
					},
				}),
			]);
		});

		it('reads the View: one self-contained HTML document, CSP on the content too', async () => {
			const body = await (await rpc('resources/read', { uri: VIEW_URI })).json();
			const [content] = body.result.contents;
			expect(content.uri).toBe(VIEW_URI);
			expect(content.mimeType).toBe('text/html;profile=mcp-app');
			expect(content.text).toMatch(/<!doctype html>/);
			expect(content.text).toContain("connect-src 'none'");
			expect(content._meta.ui.csp.connectDomains).toEqual([]);
		});

		it('answers every client: text plus the same projection as structuredContent', async () => {
			const body = await (
				await rpc('tools/call', { name: 'explore_patterns', arguments: { id: 'ai-surfaces' } })
			).json();
			const { result } = body;
			expect(result.isError).toBeFalsy();
			expect(result.content[0].text).toMatch(/^# .+\(`ai-surfaces`\)/);
			expect(result.content[0].text).toContain('http://localhost/docs/pattern-library/ai-surfaces');
			expect(result.structuredContent.kind).toBe('focus');
			expect(result.structuredContent.focus.id).toBe('ai-surfaces');
			expect(result.structuredContent.focus.docsUrl).toBe('http://localhost/docs/pattern-library/ai-surfaces');
		});

		it('an unknown id is a tool error with recovery steps and no structured payload', async () => {
			const body = await (await rpc('tools/call', { name: 'explore_patterns', arguments: { id: 'nope' } })).json();
			expect(body.result.isError).toBe(true);
			expect(body.result).not.toHaveProperty('structuredContent');
			expect(body.result.content[0].text).toContain('## Next actions');
		});
	});

	it('rejects an admin mutation submitted to the public endpoint', async () => {
		const res = await rpc('tools/call', { name: 'set_mcp_page_message', arguments: { message: 'x' } });
		const body = await res.json();
		expect(body.error.code).toBe(-32602);
		expect(body).not.toHaveProperty('result');
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
		expect(body.error.message).toMatch(/Unsupported protocol version/);
	});

	it('accepts a supported MCP-Protocol-Version header', async () => {
		const res = await post(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }), {
			'mcp-protocol-version': '2025-06-18',
		});
		expect(res.status).toBe(200);
	});
});

describe('telemetry wiring', () => {
	it('records exactly one observation for a served request', async () => {
		telemetry.observed.length = 0;
		telemetry.gateRejections.length = 0;
		await rpc('ping');
		expect(telemetry.observed).toHaveLength(1);
		expect(telemetry.gateRejections).toHaveLength(0);
	});

	it('writes NOTHING when the request is rate-limited', async () => {
		// The limiter exists to make refusal cheap. Writing a row on refusal would invert it into an
		// amplifier: a flood would become an equal number of database inserts, so the control meant to
		// shed load would itself become the load. Counting refusals is a counter's job, not a log's.
		telemetry.observed.length = 0;
		telemetry.gateRejections.length = 0;
		limiterState.success = false;
		try {
			const res = await rpc('ping');
			expect(res.status).toBe(429);
			expect(telemetry.observed).toHaveLength(0);
			expect(telemetry.gateRejections).toHaveLength(0);
		} finally {
			limiterState.success = true;
		}
	});
});
