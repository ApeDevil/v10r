import { describe, expect, it, vi } from 'vitest';

// Neither the list nor the cross-registry rejection paths touch the DB; stub it so importing
// the admin registry never constructs a real Neon pool.
vi.mock('$lib/server/db', () => ({ db: {} }));
vi.mock('$lib/server/admin/audit', () => ({ recordAuditEvent: vi.fn(), queryAuditLog: vi.fn() }));

const { handleMcpMessage } = await import('./transport');
const { publicPatternRegistry } = await import('./patterns/tools');
const { adminStateRegistry } = await import('./demo/tools');

const IDENTITY = { name: 'test', version: '0.0.1', instructions: 'test server' };

function call(method: string, params?: unknown, registry = publicPatternRegistry, id: unknown = 1) {
	return handleMcpMessage({ jsonrpc: '2.0', id, method, params }, registry, IDENTITY);
}

const PATTERN_TOOL_NAMES = [
	'search_patterns',
	'get_pattern',
	'get_file_excerpt',
	'trace_capability',
	'recommend_emulation_plan',
	'validate_snippet',
];
const ADMIN_TOOL_NAMES = [
	'get_mcp_page_state',
	'set_mcp_page_message',
	'set_mcp_page_color',
	'reset_mcp_page_state',
	'get_mcp_page_history',
];

describe('protocol basics', () => {
	it('initialize returns serverInfo, protocol version, and tools capability', async () => {
		const res = await call('initialize', { protocolVersion: '2025-06-18' });
		expect(res).toMatchObject({
			result: {
				protocolVersion: '2025-06-18',
				serverInfo: { name: 'test' },
				capabilities: { tools: expect.any(Object) },
			},
		});
	});

	it('ping returns an empty result', async () => {
		const res = await call('ping');
		expect(res).toMatchObject({ result: {} });
	});

	it('a notification (no id) is acknowledged with no response body', async () => {
		const res = await handleMcpMessage(
			{ jsonrpc: '2.0', method: 'notifications/initialized' },
			publicPatternRegistry,
			IDENTITY,
		);
		expect(res).toBeNull();
	});

	it('rejects an unknown method with JSON-RPC -32601', async () => {
		const res = await call('does/not/exist');
		expect(res && 'error' in res && res.error.code).toBe(-32601);
	});

	it('rejects a wrong jsonrpc version (-32600) without dispatching', async () => {
		const res = await handleMcpMessage(
			{ jsonrpc: '1.0', id: 1, method: 'tools/list' },
			publicPatternRegistry,
			IDENTITY,
		);
		expect(res && 'error' in res && res.error.code).toBe(-32600);
	});

	it('rejects a missing jsonrpc field (-32600)', async () => {
		const res = await handleMcpMessage({ id: 1, method: 'ping' }, publicPatternRegistry, IDENTITY);
		expect(res && 'error' in res && res.error.code).toBe(-32600);
	});

	it('rejects a non-scalar id (-32600) without dispatching', async () => {
		const res = await handleMcpMessage(
			{ jsonrpc: '2.0', id: { bad: true }, method: 'tools/list' },
			publicPatternRegistry,
			IDENTITY,
		);
		expect(res && 'error' in res && res.error.code).toBe(-32600);
	});

	it('rejects a batch (array) request', async () => {
		const res = await handleMcpMessage([{ jsonrpc: '2.0', id: 1, method: 'ping' }], publicPatternRegistry, IDENTITY);
		expect(res && 'error' in res && res.error.code).toBe(-32600);
	});
});

describe('public registry exposes only the six read-only Pattern tools', () => {
	it('tools/list returns exactly the pattern tools', async () => {
		const res = await call('tools/list');
		const names = (res as { result: { tools: { name: string }[] } }).result.tools.map((t) => t.name);
		expect(names.sort()).toEqual([...PATTERN_TOOL_NAMES].sort());
	});

	it('lists no admin tool', () => {
		const names = publicPatternRegistry.tools.map((t) => t.name);
		for (const admin of ADMIN_TOOL_NAMES) expect(names).not.toContain(admin);
	});
});

describe('admin registry exposes only the demo-state tools', () => {
	it('tools/list returns exactly the admin tools', async () => {
		const res = await call('tools/list', undefined, adminStateRegistry);
		const names = (res as { result: { tools: { name: string }[] } }).result.tools.map((t) => t.name);
		expect(names.sort()).toEqual([...ADMIN_TOOL_NAMES].sort());
	});

	it('lists no pattern tool', () => {
		const names = adminStateRegistry.tools.map((t) => t.name);
		for (const pub of PATTERN_TOOL_NAMES) expect(names).not.toContain(pub);
	});
});

describe('hard dispatch separation', () => {
	it('rejects an admin mutation submitted to the PUBLIC endpoint', async () => {
		const res = await call('tools/call', { name: 'set_mcp_page_message', arguments: { message: 'pwned' } });
		const result = (res as { result: { isError?: boolean; content: { text: string }[] } }).result;
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toMatch(/does not expose|Unknown tool/i);
	});

	it('rejects every admin tool name on the public endpoint', async () => {
		for (const name of ADMIN_TOOL_NAMES) {
			const res = await call('tools/call', { name, arguments: {} });
			expect((res as { result: { isError?: boolean } }).result.isError).toBe(true);
		}
	});

	it('rejects a pattern tool submitted to the ADMIN endpoint', async () => {
		const res = await call('tools/call', { name: 'get_pattern', arguments: { id: 'x' } }, adminStateRegistry);
		expect((res as { result: { isError?: boolean } }).result.isError).toBe(true);
	});
});

describe('public read-only tools still work', () => {
	it('dispatches search_patterns without a database', async () => {
		const res = await call('tools/call', { name: 'search_patterns', arguments: { query: 'architecture' } });
		const result = (res as { result: { isError?: boolean; content: { text: string }[] } }).result;
		expect(result.isError).toBeFalsy();
		expect(result.content[0].text.length).toBeGreaterThan(0);
	});

	it('reports bad tools/call params as an error', async () => {
		const res = await call('tools/call', { notName: true });
		expect(res && 'error' in res && res.error.code).toBe(-32602);
	});
});
