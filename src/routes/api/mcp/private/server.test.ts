import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { publicPatternRegistry } from '$lib/server/mcp/patterns/tools';

const limiterState = vi.hoisted(() => ({ success: true }));
vi.mock('$lib/server/http/rate-limit', () => ({
	createLimiter: () => ({ limit: async () => ({ success: limiterState.success, reset: 0 }) }),
	rateLimitResponse: () => new Response('{}', { status: 429 }),
}));
// Pattern dispatch is pure CPU over the static registry, so the DB is never touched.
vi.mock('$lib/server/db', () => ({ db: {} }));
// Mock the telemetry seam so assertions are about the wiring, not about a database write.
const telemetry = vi.hoisted(() => ({ observed: [] as unknown[], gateRejections: [] as string[][] }));
vi.mock('$lib/server/mcp/telemetry/observer', () => ({
	createMcpObserver: () => ({ observe: (o: unknown) => telemetry.observed.push(o) }),
	recordMcpGateRejection: (_ctx: unknown, reason: string) => telemetry.gateRejections.push([reason]),
}));

const { GET, POST } = await import('./+server');

const TOKEN = 'test-private-token-abcdefghijklmnop';
const ADMIN_TOKEN = 'test-admin-token-abcdefghijklmnop';

type PostEvent = Parameters<typeof POST>[0];
function post(rawBody: string, authorization?: string) {
	const request = new Request('http://localhost/api/mcp/private', {
		method: 'POST',
		body: rawBody,
		headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}) },
	});
	return POST({ request, getClientAddress: () => '127.0.0.1' } as unknown as PostEvent);
}
const rpc = (method: string, auth?: string, params?: unknown) =>
	post(JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), auth);

beforeEach(() => {
	process.env.MCP_PRIVATE_TOKEN = TOKEN;
	limiterState.success = true;
});
afterEach(() => {
	delete process.env.MCP_PRIVATE_TOKEN;
	delete process.env.MCP_ADMIN_TOKEN;
});

describe('private endpoint authentication', () => {
	it('rate-limits BEFORE the bearer check (no unthrottled token brute-force)', async () => {
		limiterState.success = false;
		const res = await rpc('tools/list'); // no bearer at all
		expect(res.status).toBe(429);
	});

	it('rejects a request with no bearer credential (401) with the private realm and code', async () => {
		const res = await rpc('tools/list');
		expect(res.status).toBe(401);
		expect(res.headers.get('www-authenticate')).toBe('Bearer realm="v10r-mcp-private"');
		const body = await res.json();
		expect(body.error.code).toBe('mcp_private_unauthorized');
		expect(body).not.toHaveProperty('result');
	});

	it('rejects an invalid bearer credential (401)', async () => {
		const res = await rpc('tools/list', 'Bearer wrong-token');
		expect(res.status).toBe(401);
	});

	it('rejects a valid ADMIN token — realm isolation at the route level', async () => {
		process.env.MCP_ADMIN_TOKEN = ADMIN_TOKEN;
		const res = await rpc('tools/list', `Bearer ${ADMIN_TOKEN}`);
		expect(res.status).toBe(401);
	});

	it('returns 503 with the private code when the server has no token configured', async () => {
		delete process.env.MCP_PRIVATE_TOKEN;
		const res = await rpc('tools/list', `Bearer ${TOKEN}`);
		expect(res.status).toBe(503);
		const body = await res.json();
		expect(body.error.code).toBe('mcp_private_unconfigured');
	});

	it('GET returns 405 with no auth and no tool metadata (no bearer path outside POST)', async () => {
		const res = await GET({} as unknown as Parameters<typeof GET>[0]);
		expect(res.status).toBe(405);
		expect(res.headers.get('allow')).toBe('POST');
		const body = await res.json();
		expect(body).not.toHaveProperty('tools');
	});
});

describe('private endpoint with a valid credential', () => {
	it('lists exactly the public pattern registry tools — derived, never a literal list', async () => {
		const res = await rpc('tools/list', `Bearer ${TOKEN}`);
		expect(res.status).toBe(200);
		const body = await res.json();
		// Derived from the registry on purpose: hard-coding the six names here would create another
		// order-pinned site, which the ax sprawl checklist exists to prevent.
		expect(body.result.tools.map((t: { name: string }) => t.name)).toEqual(
			publicPatternRegistry.tools.map((t) => t.name),
		);
	});

	it('does not expose the admin demo-state tools', async () => {
		const res = await rpc('tools/call', `Bearer ${TOKEN}`, { name: 'get_mcp_page_state', arguments: {} });
		const body = await res.json();
		expect(body.result.isError).toBe(true);
	});
});

describe('telemetry wiring', () => {
	beforeEach(() => {
		telemetry.observed.length = 0;
		telemetry.gateRejections.length = 0;
	});

	it('records a failed credential as a gate rejection, not as a tool error', async () => {
		const res = await rpc('tools/list', 'Bearer wrong-token');
		expect(res.status).toBe(401);
		expect(telemetry.gateRejections).toEqual([['unauthorized']]);
		expect(telemetry.observed).toHaveLength(0);
	});

	it('distinguishes an unconfigured server from a rejected credential', async () => {
		delete process.env.MCP_PRIVATE_TOKEN;
		const res = await rpc('tools/list', `Bearer ${TOKEN}`);
		expect(res.status).toBe(503);
		expect(telemetry.gateRejections).toEqual([['unconfigured']]);
	});

	it('writes nothing at all when rate-limited', async () => {
		limiterState.success = false;
		try {
			const res = await rpc('tools/list', `Bearer ${TOKEN}`);
			expect(res.status).toBe(429);
			expect(telemetry.observed).toHaveLength(0);
			expect(telemetry.gateRejections).toHaveLength(0);
		} finally {
			limiterState.success = true;
		}
	});

	it('records exactly one observation for an authorised request', async () => {
		await rpc('tools/list', `Bearer ${TOKEN}`);
		expect(telemetry.observed).toHaveLength(1);
		expect(telemetry.gateRejections).toHaveLength(0);
	});
});
