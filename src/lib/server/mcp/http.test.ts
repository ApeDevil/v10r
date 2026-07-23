import { afterEach, describe, expect, it } from 'vitest';
import { isAllowedOrigin, mcpMethodNotAllowed, protocolVersionHeaderOk, respondToMcpPost } from './http';
import type { ToolRegistry } from './types';

const registry: ToolRegistry = {
	tools: [{ name: 'noop', description: 'noop', inputSchema: { type: 'object' } }],
	dispatch: () => ({ content: [{ type: 'text', text: 'ok' }] }),
};
const identity = { name: 'test', version: '0.0.0', instructions: 'test' };

function req(headers: Record<string, string>, body?: string): Request {
	return new Request('http://localhost/api/mcp/public', {
		method: 'POST',
		headers: { 'content-type': 'application/json', ...headers },
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

	it('matches any scheme for an explicit bare-host allowlist entry', () => {
		process.env.MCP_ALLOWED_ORIGINS = 'bare.example';
		expect(isAllowedOrigin(req({ origin: 'https://bare.example' }))).toBe(true);
		expect(isAllowedOrigin(req({ origin: 'http://bare.example' }))).toBe(true);
		expect(isAllowedOrigin(req({ origin: 'https://other.example' }))).toBe(false);
	});
});

describe('protocolVersionHeaderOk', () => {
	it('accepts an absent header (default negotiated in body)', () => {
		expect(protocolVersionHeaderOk(req({}))).toBe(true);
	});
	it('accepts a supported version', () => {
		expect(protocolVersionHeaderOk(req({ 'mcp-protocol-version': '2025-06-18' }))).toBe(true);
	});
	it('rejects an unsupported version', () => {
		expect(protocolVersionHeaderOk(req({ 'mcp-protocol-version': '1999-01-01' }))).toBe(false);
	});
});

describe('respondToMcpPost', () => {
	const ping = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' });

	it('dispatches a valid request', async () => {
		const res = await respondToMcpPost(req({}, ping), registry, identity);
		expect(res.status).toBe(200);
		expect((await res.json()).result).toEqual({});
	});

	it('rejects a bad Origin with 403', async () => {
		const res = await respondToMcpPost(req({ origin: 'http://evil.example' }, ping), registry, identity);
		expect(res.status).toBe(403);
	});

	it('rejects an unsupported protocol header with 400', async () => {
		const res = await respondToMcpPost(req({ 'mcp-protocol-version': 'nope' }, ping), registry, identity);
		expect(res.status).toBe(400);
		expect((await res.json()).error.code).toBe('unsupported_protocol_version');
	});

	it('returns a 400 parse error on malformed JSON', async () => {
		const res = await respondToMcpPost(req({}, 'not json'), registry, identity);
		expect(res.status).toBe(400);
		expect((await res.json()).error.code).toBe(-32700);
	});

	it('acknowledges a notification with 202', async () => {
		const res = await respondToMcpPost(
			req({}, JSON.stringify({ jsonrpc: '2.0', method: 'x/notify' })),
			registry,
			identity,
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
		const res = await respondToMcpPost(listReq, boomRegistry, identity);
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.error.code).toBe(-32603);
		expect(JSON.stringify(body)).not.toMatch(/boom/); // exception detail is not leaked
	});
});
