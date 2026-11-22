import { afterEach, describe, expect, it } from 'vitest';
import { isAllowedOrigin, mcpMethodNotAllowed, respondToMcpPost } from './http.adapter';
import { MCP_CLIENT_HEADERS } from './mcp-post.ts';
import { type McpCallObserver, noopMcpObserver, type ToolRegistry } from './types';

const registry: ToolRegistry = {
	tools: [{ name: 'noop', description: 'noop', inputSchema: { type: 'object' } }],
	dispatch: () => ({ content: [{ type: 'text', text: 'ok' }] }),
};
const identity = { name: 'test', version: '0.0.0', instructions: 'test', cacheScope: 'public' as const };

function req(headers: Record<string, string>, body?: string): Request {
	return new Request('http://localhost/api/mcp/public', {
		method: 'POST',
		headers: { ...MCP_CLIENT_HEADERS, ...headers },
		body,
	});
}

afterEach(() => {
	delete process.env.MCP_ALLOWED_ORIGINS;
});

describe('mcpMethodNotAllowed', () => {
	it('is 405 with Allow: POST and no tool metadata', async () => {
		const res = mcpMethodNotAllowed();
		expect(res.status).toBe(405);
		expect(res.headers.get('allow')).toBe('POST');
		expect(await res.json()).not.toHaveProperty('tools');
	});
});

// Build a request with an explicit URL (to vary the request's own scheme/port).
function reqWithUrl(url: string, headers: Record<string, string>): Request {
	return new Request(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers } });
}

describe('isAllowedOrigin', () => {
	it('allows a request with no Origin (non-browser MCP client)', () => {
		expect(isAllowedOrigin(req({}))).toBe(true);
	});

	it('accepts an exact same-origin request (scheme + host + port)', () => {
		// req() URL is http://localhost, so an http://localhost Origin is exactly same-origin.
		expect(isAllowedOrigin(req({ origin: 'http://localhost' }))).toBe(true);
	});

	it('rejects a cross-scheme same-host Origin (https Origin for an http request URL)', () => {
		expect(isAllowedOrigin(req({ origin: 'https://localhost' }))).toBe(false);
	});

	it('rejects an http Origin for an https request URL (cross-scheme same-host)', () => {
		const request = reqWithUrl('https://localhost/api/mcp/public', { origin: 'http://localhost' });
		expect(isAllowedOrigin(request)).toBe(false);
	});

	it('rejects a cross-host Origin (DNS-rebinding)', () => {
		expect(isAllowedOrigin(req({ origin: 'http://attacker.example' }))).toBe(false);
	});

	it('rejects a malformed Origin', () => {
		expect(isAllowedOrigin(req({ origin: 'not-a-url' }))).toBe(false);
	});

	it('honors the MCP_ALLOWED_ORIGINS allowlist', () => {
		process.env.MCP_ALLOWED_ORIGINS = 'http://trusted.example, other.example';
		expect(isAllowedOrigin(req({ origin: 'http://trusted.example' }))).toBe(true);
		expect(isAllowedOrigin(req({ origin: 'http://untrusted.example' }))).toBe(false);
	});

	it('scheme-pins an explicit full-origin allowlist entry', () => {
		process.env.MCP_ALLOWED_ORIGINS = 'https://trusted.example';
		expect(isAllowedOrigin(req({ origin: 'https://trusted.example' }))).toBe(true);
		// same host, different scheme → NOT matched by a full-origin (scheme-pinned) entry
		expect(isAllowedOrigin(req({ origin: 'http://trusted.example' }))).toBe(false);
	});

	it('normalizes a bare-host allowlist entry to https rather than accepting any scheme', () => {
		// A bare host used to match every scheme, so one config line silently
		// admitted the plaintext origin too. The operator's intent is kept; the
		// downgrade is not. Writing `http://bare.example` explicitly still works.
		process.env.MCP_ALLOWED_ORIGINS = 'bare.example';
		expect(isAllowedOrigin(req({ origin: 'https://bare.example' }))).toBe(true);
		expect(isAllowedOrigin(req({ origin: 'http://bare.example' }))).toBe(false);
		expect(isAllowedOrigin(req({ origin: 'https://other.example' }))).toBe(false);
	});

	it('still allows an explicitly plaintext entry, which local MCP clients need', () => {
		process.env.MCP_ALLOWED_ORIGINS = 'http://127.0.0.1:6274';
		expect(isAllowedOrigin(req({ origin: 'http://127.0.0.1:6274' }))).toBe(true);
		expect(isAllowedOrigin(req({ origin: 'http://127.0.0.1:9999' }))).toBe(false);
	});

	it('ignores an unparseable allowlist entry instead of throwing', () => {
		process.env.MCP_ALLOWED_ORIGINS = ' , ://nonsense, https://good.example';
		expect(isAllowedOrigin(req({ origin: 'https://good.example' }))).toBe(true);
		expect(isAllowedOrigin(req({ origin: 'https://bad.example' }))).toBe(false);
	});

	it('never matches on host alone when a port differs', () => {
		process.env.MCP_ALLOWED_ORIGINS = 'https://app.example';
		expect(isAllowedOrigin(req({ origin: 'https://app.example:8443' }))).toBe(false);
	});
});

describe('respondToMcpPost', () => {
	const ping = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' });

	it('dispatches a valid request', async () => {
		const res = await respondToMcpPost(req({}, ping), registry, identity, noopMcpObserver);
		expect(res.status).toBe(200);
		expect((await res.json()).result).toEqual({});
	});

	it('rejects a bad Origin with 403', async () => {
		const res = await respondToMcpPost(
			req({ origin: 'http://evil.example' }, ping),
			registry,
			identity,
			noopMcpObserver,
		);
		expect(res.status).toBe(403);
	});

	it('rejects an unknown pre-2026 protocol header with a 400 naming the supported revisions', async () => {
		const res = await respondToMcpPost(
			req({ 'mcp-protocol-version': '1999-01-01' }, ping),
			registry,
			identity,
			noopMcpObserver,
		);
		expect(res.status).toBe(400);
		const body = await res.json();
		// A legacy caller, answered by the SDK's legacy transport — never a modern error code.
		expect(body.error.code).toBe(-32000);
		expect(body.error.message).toContain('2025-11-25');
	});

	it('answers 406 when the client does not accept both JSON and SSE (Streamable HTTP MUST)', async () => {
		const res = await respondToMcpPost(req({ accept: 'application/json' }, ping), registry, identity, noopMcpObserver);
		expect(res.status).toBe(406);
	});

	it('answers a modern-era header with no body envelope as a JSON-RPC -32602 400, never as legacy', async () => {
		// Revision ids compare as strings, like the official SDK: an unknown later revision (and any
		// non-date token sorting after 2026-07-28) names the modern era, so the caller learns what is
		// wrong instead of being downgraded silently.
		for (const header of ['2026-07-28', '2099-01-01', 'nope']) {
			const res = await respondToMcpPost(
				req({ 'mcp-protocol-version': header }, ping),
				registry,
				identity,
				noopMcpObserver,
			);
			expect(res.status, header).toBe(400);
			const body = await res.json();
			expect(body, header).toMatchObject({ jsonrpc: '2.0', id: 1, error: { code: -32602 } });
		}
	});

	it('returns a 400 parse error on malformed JSON', async () => {
		const res = await respondToMcpPost(req({}, 'not json'), registry, identity, noopMcpObserver);
		expect(res.status).toBe(400);
		expect((await res.json()).error.code).toBe(-32700);
	});

	it('rejects an oversized envelope with 413, not 400', async () => {
		// 413 deliberately: the forward-compatibility branch above is keyed to the
		// 400 STATUS, so a body-budget refusal must not land in it. A 400 here
		// would put a non-JSON-RPC body in front of a modern client at exactly the
		// moment it is deciding whether this server is modern.
		const huge = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping', params: { pad: 'x'.repeat(300_000) } });
		const res = await respondToMcpPost(req({}, huge), registry, identity, noopMcpObserver);
		expect(res.status).toBe(413);
		const body = await res.json();
		expect(body.error.code).toBe('payload_too_large');
		expect(body).not.toHaveProperty('jsonrpc');
	});

	it('emits exactly one observation for an oversized envelope', async () => {
		// "One helper, seven exits" — a new exit that forgets to emit breaks the
		// one-observation-per-POST invariant the telemetry depends on.
		const seen: Array<{ status: number; stage: string }> = [];
		const observer: McpCallObserver = {
			observe: (obs) => {
				seen.push({ status: obs.status, stage: obs.stage });
			},
		};
		const huge = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping', params: { pad: 'x'.repeat(300_000) } });
		await respondToMcpPost(req({}, huge), registry, identity, observer);
		expect(seen).toEqual([{ status: 413, stage: 'envelope' }]);
	});

	it('acknowledges a notification with 202', async () => {
		const res = await respondToMcpPost(
			req({}, JSON.stringify({ jsonrpc: '2.0', method: 'x/notify' })),
			registry,
			identity,
			noopMcpObserver,
		);
		expect(res.status).toBe(202);
	});

	it('returns a clean JSON-RPC internal error (no leak) if the transport throws', async () => {
		const boomRegistry = {
			get tools(): never {
				throw new Error('boom-internal-detail');
			},
			dispatch: () => ({ content: [{ type: 'text', text: '' }] }),
		} as unknown as ToolRegistry;
		// tools/list reads registry.tools, which throws — the outer catch must convert it cleanly.
		const listReq = req({}, JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }));
		const res = await respondToMcpPost(listReq, boomRegistry, identity, noopMcpObserver);
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.error.code).toBe(-32603);
		expect(JSON.stringify(body)).not.toMatch(/boom/); // exception detail is not leaked
	});

	it('emits exactly one observation on every terminating path', async () => {
		// "One POST, one row" has to be a property of the shape, not a discipline six return
		// statements each remember. Drive all six exits and count.
		const seen: Array<{ stage: string; status: number }> = [];
		const counting: McpCallObserver = {
			observe: (o) => seen.push({ stage: o.stage, status: o.status }),
		};
		const call = (r: Request, reg = registry) => respondToMcpPost(r, reg, identity, counting);

		const boomRegistry = {
			get tools(): never {
				throw new Error('boom');
			},
			dispatch: () => ({ content: [{ type: 'text', text: '' }] }),
		} as unknown as ToolRegistry;

		const exits: Array<[string, () => Promise<Response>, number]> = [
			['forbidden origin', () => call(req({ origin: 'http://evil.example' }, ping)), 403],
			['bad protocol version', () => call(req({ 'mcp-protocol-version': 'nope' }, ping)), 400],
			['parse error', () => call(req({}, 'not json')), 400],
			['batch', () => call(req({}, JSON.stringify([JSON.parse(ping)]))), 400],
			['notification', () => call(req({}, JSON.stringify({ jsonrpc: '2.0', method: 'x/notify' }))), 202],
			['success', () => call(req({}, ping)), 200],
			[
				'transport throw',
				() => call(req({}, JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })), boomRegistry),
				500,
			],
		];

		for (const [label, run, expectedStatus] of exits) {
			seen.length = 0;
			const res = await run();
			expect(res.status, label).toBe(expectedStatus);
			expect(seen.length, `${label} should emit exactly one observation`).toBe(1);
			expect(seen[0].status, label).toBe(expectedStatus);
		}
	});

	it('observes the method, tool and diag of a dispatched call', async () => {
		const seen: Parameters<McpCallObserver['observe']>[0][] = [];
		const diagRegistry: ToolRegistry = {
			tools: [{ name: 'noop', description: 'noop', inputSchema: { type: 'object' } }],
			dispatch: () => ({ content: [{ type: 'text', text: 'no match' }], isError: true, diag: 'empty' as const }),
		};
		const callReq = req(
			{},
			JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'noop', arguments: { q: 'x' } } }),
		);
		await respondToMcpPost(callReq, diagRegistry, identity, { observe: (o) => seen.push(o) });

		expect(seen).toHaveLength(1);
		expect(seen[0]).toMatchObject({
			stage: 'tool',
			method: 'tools/call',
			toolName: 'noop',
			isError: true,
			diag: 'empty',
			status: 200, // transport-level failures are 200 by design — the reason status alone is useless
		});
		expect(seen[0].handleMs).toBeGreaterThanOrEqual(0);
	});

	it('hands the observer the tool answer text on a tools/call, and only there', async () => {
		const seen: Parameters<McpCallObserver['observe']>[0][] = [];
		const answerRegistry: ToolRegistry = {
			tools: [{ name: 'noop', description: 'noop', inputSchema: { type: 'object' } }],
			dispatch: () => ({ content: [{ type: 'text', text: '# Answer\n\n```ts\ncode\n```' }] }),
		};
		const observer: McpCallObserver = { observe: (o) => seen.push(o) };

		const callReq = req({}, JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'noop' } }));
		await respondToMcpPost(callReq, answerRegistry, identity, observer);
		expect(seen[0].responseText).toBe('# Answer\n\n```ts\ncode\n```');

		// tools/list and initialize results are protocol metadata, not answers.
		seen.length = 0;
		await respondToMcpPost(
			req({}, JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })),
			answerRegistry,
			identity,
			observer,
		);
		expect(seen[0].responseText).toBeNull();

		seen.length = 0;
		await respondToMcpPost(req({}, 'not json'), answerRegistry, identity, observer);
		expect(seen[0].responseText).toBeNull();
	});

	it('truncates an oversized tool answer at capture so the deferred closure stays bounded', async () => {
		const seen: Parameters<McpCallObserver['observe']>[0][] = [];
		const bigRegistry: ToolRegistry = {
			tools: [{ name: 'noop', description: 'noop', inputSchema: { type: 'object' } }],
			dispatch: () => ({ content: [{ type: 'text', text: 'a'.repeat(30_000) }] }),
		};
		const callReq = req({}, JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'noop' } }));
		await respondToMcpPost(callReq, bigRegistry, identity, { observe: (o) => seen.push(o) });
		expect(seen[0].responseText).toHaveLength(20_000);
	});

	it('captures clientInfo from initialize, which the SDK keeps to itself', async () => {
		const seen: Parameters<McpCallObserver['observe']>[0][] = [];
		const initReq = req(
			{},
			JSON.stringify({
				jsonrpc: '2.0',
				id: 1,
				method: 'initialize',
				params: {
					protocolVersion: '2025-06-18',
					capabilities: {},
					clientInfo: { name: 'claude-ai', version: '0.1.0' },
				},
			}),
		);
		await respondToMcpPost(initReq, registry, identity, { observe: (o) => seen.push(o) });

		expect(seen[0]).toMatchObject({
			stage: 'protocol',
			method: 'initialize',
			clientName: 'claude-ai',
			clientVersion: '0.1.0',
			servedProtocolVersion: '2025-06-18',
		});
	});

	it('records the requested protocol version even when it is rejected', async () => {
		// The migration signal: a caller asking for a version we do not serve is exactly the row that
		// tells you whether to adopt it. Recording only the negotiated value would erase it.
		const seen: Parameters<McpCallObserver['observe']>[0][] = [];
		await respondToMcpPost(req({ 'mcp-protocol-version': '2026-07-28' }, ping), registry, identity, {
			observe: (o) => seen.push(o),
		});
		expect(seen[0]).toMatchObject({ status: 400, requestedProtocolVersion: '2026-07-28' });
	});

	it('never serializes the internal diag field', async () => {
		// Asserted at TEXT level, not on the parsed object: `diag` is a wire-contract concern, and a
		// structural assertion would still pass if it were serialized under a different shape.
		const diagRegistry: ToolRegistry = {
			tools: [{ name: 'noop', description: 'noop', inputSchema: { type: 'object' } }],
			dispatch: () => ({ content: [{ type: 'text', text: 'no match' }], isError: true, diag: 'empty' as const }),
		};
		const callReq = req({}, JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'noop' } }));
		const res = await respondToMcpPost(callReq, diagRegistry, identity, noopMcpObserver);
		const raw = await res.text();
		expect(raw).not.toMatch(/diag/);
		// ...while the caller-visible half of the result is untouched.
		expect(raw).toMatch(/no match/);
		expect(JSON.parse(raw).result.isError).toBe(true);
	});
});

/** A 2026-07-28 request: the `_meta` envelope in the body and the standard headers that mirror it. */
function modernReq(
	method: string,
	params: Record<string, unknown> = {},
	headerOverrides: Record<string, string | null> = {},
	version = '2026-07-28',
): Request {
	const body = {
		jsonrpc: '2.0',
		id: 7,
		method,
		params: {
			...params,
			_meta: {
				'io.modelcontextprotocol/protocolVersion': version,
				'io.modelcontextprotocol/clientCapabilities': {},
				'io.modelcontextprotocol/clientInfo': { name: 'modern-client', version: '2.0.0' },
				...(params._meta as Record<string, unknown> | undefined),
			},
		},
	};
	const headers: Record<string, string> = { 'mcp-protocol-version': version, 'mcp-method': method };
	if (typeof params.name === 'string') headers['mcp-name'] = params.name;
	for (const [key, value] of Object.entries(headerOverrides)) {
		if (value === null) delete headers[key];
		else headers[key] = value;
	}
	return req(headers, JSON.stringify(body));
}

async function post(request: Request) {
	const seen: Parameters<McpCallObserver['observe']>[0][] = [];
	const res = await respondToMcpPost(request, registry, identity, { observe: (o) => seen.push(o) });
	return { status: res.status, body: await res.clone().json(), response: res, observation: seen[0] };
}

describe('respondToMcpPost — modern era (2026-07-28)', () => {
	it('server/discover advertises the modern revision, the same capabilities as initialize, and caching hints', async () => {
		const { status, body } = await post(modernReq('server/discover'));
		expect(status).toBe(200);
		expect(body).toMatchObject({
			id: 7,
			result: {
				resultType: 'complete',
				supportedVersions: ['2026-07-28'],
				capabilities: { tools: { listChanged: false } },
				instructions: 'test',
				ttlMs: expect.any(Number),
				cacheScope: 'public',
				_meta: { 'io.modelcontextprotocol/serverInfo': { name: 'test', version: '0.0.0' } },
			},
		});
		expect(Number.isInteger(body.result.ttlMs) && body.result.ttlMs >= 0).toBe(true);
	});

	it('tools/list carries resultType and the caching hints; the tools are the registry, unchanged', async () => {
		const { body } = await post(modernReq('tools/list'));
		expect(body.result).toMatchObject({ resultType: 'complete', cacheScope: 'public', tools: registry.tools });
	});

	it('takes the cache scope from the surface identity', async () => {
		const res = await respondToMcpPost(
			modernReq('tools/list'),
			registry,
			{ ...identity, cacheScope: 'private' },
			noopMcpObserver,
		);
		expect((await res.json()).result.cacheScope).toBe('private');
	});

	it('tools/call dispatches through the same registry and marks the result complete', async () => {
		const { status, body, observation } = await post(modernReq('tools/call', { name: 'noop', arguments: {} }));
		expect(status).toBe(200);
		expect(body.result).toMatchObject({ resultType: 'complete', content: [{ type: 'text', text: 'ok' }] });
		expect(observation).toMatchObject({
			stage: 'tool',
			toolName: 'noop',
			clientName: 'modern-client',
			clientVersion: '2.0.0',
			servedProtocolVersion: '2026-07-28',
		});
	});

	it('answers an unknown tool with the in-band -32602 the spec requires, without dispatching', async () => {
		let dispatched = 0;
		const counting: ToolRegistry = {
			...registry,
			dispatch: (...args) => {
				dispatched += 1;
				return registry.dispatch(...args);
			},
		};
		const seen: Parameters<McpCallObserver['observe']>[0][] = [];
		const res = await respondToMcpPost(modernReq('tools/call', { name: 'not_here' }), counting, identity, {
			observe: (o) => seen.push(o),
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ id: 7, error: { code: -32602 } });
		expect(dispatched).toBe(0);
		// Telemetry sees the same unknown-tool event as on the legacy path: tool stage, the name, no diag.
		expect(seen[0]).toMatchObject({ stage: 'tool', toolName: 'not_here', isError: true, diag: null });
	});

	it('answers an unknown tool the same way on the legacy path: -32602, never dispatched', async () => {
		// The hand-written transport answered legacy callers an isError result instead; the SDK gives
		// both eras the spec's protocol error. Telemetry classifies both identically.
		const seen: Parameters<McpCallObserver['observe']>[0][] = [];
		const res = await respondToMcpPost(
			req({}, JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'not_here' } })),
			registry,
			identity,
			{ observe: (o) => seen.push(o) },
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toMatchObject({ id: 1, error: { code: -32602 } });
		expect(body).not.toHaveProperty('result');
		expect(seen[0]).toMatchObject({ stage: 'tool', toolName: 'not_here', isError: true, diag: null });
	});

	it('answers removed and unknown methods with 404 / -32601, echoing the id', async () => {
		for (const method of ['initialize', 'ping', 'logging/setLevel', 'resources/subscribe', 'no/such']) {
			const { status, body, observation } = await post(modernReq(method));
			expect(status, method).toBe(404);
			expect(body, method).toMatchObject({ id: 7, error: { code: -32601 } });
			expect(observation?.stage, method).toBe('protocol');
		}
	});

	it('does not implement subscriptions/listen: 404 / -32601, JSON, no stream opened', async () => {
		// The server declares nothing a listen stream could deliver (tools.listChanged: false, no
		// resources), and a serverless function cannot hold one; an unimplemented method is 404.
		const { status, body, response, observation } = await post(
			modernReq('subscriptions/listen', { notifications: { toolsListChanged: true } }),
		);
		expect(status).toBe(404);
		expect(response.headers.get('content-type')).toContain('application/json');
		expect(body).toMatchObject({ jsonrpc: '2.0', id: 7, error: { code: -32601 } });
		expect(observation?.stage).toBe('protocol');
	});

	it('answers an unsupported modern revision with -32022 listing the modern revisions only', async () => {
		const { status, body, observation } = await post(modernReq('server/discover', {}, {}, '2099-01-01'));
		expect(status).toBe(400);
		expect(body).toMatchObject({
			id: 7,
			error: { code: -32022, data: { supported: ['2026-07-28'], requested: '2099-01-01' } },
		});
		expect(observation).toMatchObject({ stage: 'envelope', rpcErrorCode: -32022 });
	});

	it('rejects an invalid envelope with 400 / -32602', async () => {
		for (const _meta of [
			{ 'io.modelcontextprotocol/clientCapabilities': undefined },
			{ 'io.modelcontextprotocol/clientCapabilities': 'all' },
			{ 'io.modelcontextprotocol/clientInfo': { name: 'x' } },
			{ 'io.modelcontextprotocol/protocolVersion': 20260728 },
		]) {
			// JSON.stringify drops an `undefined` value, so that case sends no clientCapabilities key at all.
			const request = modernReq('tools/list', { _meta });
			const { status, body } = await post(request);
			expect(status, JSON.stringify(_meta)).toBe(400);
			expect(body.error.code, JSON.stringify(_meta)).toBe(-32602);
		}
	});

	it('rejects headers that disagree with the body, or are missing, with 400 / -32020', async () => {
		const cases: Array<[string, Request]> = [
			['version mismatch', modernReq('tools/list', {}, { 'mcp-protocol-version': '2025-11-25' })],
			['method mismatch', modernReq('tools/list', {}, { 'mcp-method': 'tools/call' })],
			['name mismatch', modernReq('tools/call', { name: 'noop' }, { 'mcp-name': 'other' })],
			['version missing', modernReq('tools/list', {}, { 'mcp-protocol-version': null })],
			['method missing', modernReq('tools/list', {}, { 'mcp-method': null })],
			['name missing', modernReq('tools/call', { name: 'noop' }, { 'mcp-name': null })],
			['bad base64 sentinel', modernReq('tools/call', { name: 'noop' }, { 'mcp-name': '=?base64?***?=' })],
			[
				'initialize under a modern header',
				req(
					{ 'mcp-protocol-version': '2026-07-28' },
					JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'initialize', params: { protocolVersion: '2025-11-25' } }),
				),
			],
		];
		for (const [label, request] of cases) {
			const { status, body } = await post(request);
			expect(status, label).toBe(400);
			expect(body, label).toMatchObject({ id: 7, error: { code: -32020 } });
		}
	});

	it('accepts an Mcp-Name with surrounding whitespace or in the Base64 sentinel', async () => {
		for (const header of ['  noop\t', `=?base64?${btoa('noop')}?=`]) {
			const { status, body } = await post(modernReq('tools/call', { name: 'noop' }, { 'mcp-name': header }));
			expect(status, header).toBe(200);
			expect(body.result.isError, header).toBeFalsy();
		}
	});

	it('leaves the legacy path byte-identical: no resultType, no caching hints, no header rules', async () => {
		const res = await respondToMcpPost(
			req({}, JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })),
			registry,
			identity,
			noopMcpObserver,
		);
		expect(await res.json()).toEqual({ jsonrpc: '2.0', id: 1, result: { tools: registry.tools } });
	});
});
