import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { publicPatternRegistry } from '$lib/server/mcp/patterns/tools';

/**
 * The two bearer-authenticated MCP routes, held to ONE contract.
 *
 * `/api/mcp/private` and `/api/mcp/admin` are the same gate over different realms and
 * registries, and their suites had drifted: private asserted the `www-authenticate`
 * realm, the error code and cross-realm token rejection; admin asserted none of the
 * three, though its route emits all of them. Parameterising makes the weaker surface
 * inherit the stronger surface's checks, and makes a future third realm one row.
 *
 * The dispatch/protocol paths themselves are NOT re-tested here — `mcp/http.test.ts`
 * drives `respondToMcpPost` unmocked, and these routes call it unchanged. What is
 * route-local, and therefore what this file covers, is the gate order and the wiring.
 */

const limiterState = vi.hoisted(() => ({ success: true }));
vi.mock('$lib/server/http/rate-limit', () => ({
	createLimiter: () => ({ limit: async () => ({ success: limiterState.success, reset: 0 }) }),
	rateLimitResponse: () => new Response('{}', { status: 429 }),
}));
// tools/list and every auth-failure path dispatch nothing, so the DB is never touched.
vi.mock('$lib/server/db', () => ({ db: {} }));
vi.mock('$lib/server/admin/audit', () => ({ recordAuditEvent: vi.fn(), queryAuditLog: vi.fn() }));
// Mock the telemetry seam so assertions are about the wiring, not about a database write.
const telemetry = vi.hoisted(() => ({ observed: [] as unknown[], gateRejections: [] as string[][] }));
vi.mock('$lib/server/mcp/telemetry/observer', () => ({
	createMcpObserver: () => ({ observe: (o: unknown) => telemetry.observed.push(o) }),
	recordMcpGateRejection: (_ctx: unknown, reason: string) => telemetry.gateRejections.push([reason]),
}));

const privateRoute = await import('./private/+server');
const adminRoute = await import('./admin/+server');

const PRIVATE_TOKEN = 'test-private-token-abcdefghijklmnop';
const ADMIN_TOKEN = 'test-admin-token-abcdefghijklmnop';

const SURFACES = [
	{
		surface: 'private',
		route: privateRoute,
		envName: 'MCP_PRIVATE_TOKEN',
		token: PRIVATE_TOKEN,
		otherEnvName: 'MCP_ADMIN_TOKEN',
		otherToken: ADMIN_TOKEN,
		realm: 'Bearer realm="v10r-mcp-private"',
		codePrefix: 'mcp_private',
		// Derived from the registry on purpose: hard-coding the six names here would create
		// another order-pinned site, which the ax sprawl checklist exists to prevent.
		expectedTools: () => publicPatternRegistry.tools.map((t) => t.name),
		foreignCall: { name: 'get_mcp_page_state', arguments: {} },
	},
	{
		surface: 'admin',
		route: adminRoute,
		envName: 'MCP_ADMIN_TOKEN',
		token: ADMIN_TOKEN,
		otherEnvName: 'MCP_PRIVATE_TOKEN',
		otherToken: PRIVATE_TOKEN,
		realm: 'Bearer realm="v10r-mcp-admin"',
		codePrefix: 'mcp_admin',
		expectedTools: () => [
			'get_mcp_page_history',
			'get_mcp_page_state',
			'reset_mcp_page_state',
			'set_mcp_page_color',
			'set_mcp_page_message',
		],
		foreignCall: { name: 'get_pattern', arguments: { id: 'x' } },
	},
] as const;

afterEach(() => {
	delete process.env.MCP_PRIVATE_TOKEN;
	delete process.env.MCP_ADMIN_TOKEN;
});

describe.each(SURFACES)('$surface MCP endpoint', ({
	surface,
	route,
	envName,
	token,
	otherEnvName,
	otherToken,
	realm,
	codePrefix,
	expectedTools,
	foreignCall,
}) => {
	// The two routes carry different RouteId generics, so their handlers do not share an
	// event type. Only `request` and `getClientAddress` are read here.
	type Handler = (event: { request: Request; getClientAddress: () => string }) => Promise<Response>;
	const POST = route.POST as unknown as Handler;
	const GET = route.GET as unknown as Handler;
	const rpc = (method: string, auth?: string, params?: unknown) => {
		const request = new Request(`http://localhost/api/mcp/${surface}`, {
			method: 'POST',
			body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
			headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) },
		});
		return POST({ request, getClientAddress: () => '127.0.0.1' });
	};

	beforeEach(() => {
		process.env[envName] = token;
		limiterState.success = true;
		telemetry.observed.length = 0;
		telemetry.gateRejections.length = 0;
	});

	describe('authentication', () => {
		it('rate-limits BEFORE the bearer check (no unthrottled token brute-force)', async () => {
			limiterState.success = false;
			const res = await rpc('tools/list'); // no bearer at all
			expect(res.status).toBe(429); // throttled, not a cheap 401 an attacker can spam
		});

		it('rejects a request with no bearer credential (401) with this realm and code', async () => {
			const res = await rpc('tools/list');
			expect(res.status).toBe(401);
			expect(res.headers.get('www-authenticate')).toBe(realm);
			const body = await res.json();
			expect(body.error.code).toBe(`${codePrefix}_unauthorized`);
			expect(body).not.toHaveProperty('result');
		});

		it('rejects an invalid bearer credential (401)', async () => {
			const res = await rpc('tools/list', 'Bearer wrong-token');
			expect(res.status).toBe(401);
		});

		it("rejects the OTHER realm's valid token — realm isolation at the route level", async () => {
			process.env[otherEnvName] = otherToken;
			const res = await rpc('tools/list', `Bearer ${otherToken}`);
			expect(res.status).toBe(401);
		});

		it('returns 503 with this realm’s code when the server has no token configured', async () => {
			delete process.env[envName];
			const res = await rpc('tools/list', `Bearer ${token}`);
			expect(res.status).toBe(503);
			const body = await res.json();
			expect(body.error.code).toBe(`${codePrefix}_unconfigured`);
		});

		it('GET returns 405 with no auth and no tool metadata (no bearer path outside POST)', async () => {
			const res = await GET({} as unknown as Parameters<Handler>[0]);
			expect(res.status).toBe(405);
			expect(res.headers.get('allow')).toBe('POST');
			const body = await res.json();
			expect(body).not.toHaveProperty('tools');
		});
	});

	describe('with a valid credential', () => {
		it('lists exactly this surface’s registry tools', async () => {
			const res = await rpc('tools/list', `Bearer ${token}`);
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.result.tools.map((t: { name: string }) => t.name).sort()).toEqual([...expectedTools()].sort());
		});

		it('does not expose the other surface’s tools', async () => {
			const res = await rpc('tools/call', `Bearer ${token}`, foreignCall);
			const body = await res.json();
			expect(body.result.isError).toBe(true);
		});
	});

	describe('telemetry wiring', () => {
		it('records a failed credential as a gate rejection, not as a tool error', async () => {
			const res = await rpc('tools/list', 'Bearer wrong-token');
			expect(res.status).toBe(401);
			expect(telemetry.gateRejections).toEqual([['unauthorized']]);
			expect(telemetry.observed).toHaveLength(0);
		});

		it('distinguishes an unconfigured server from a rejected credential', async () => {
			delete process.env[envName];
			const res = await rpc('tools/list', `Bearer ${token}`);
			expect(res.status).toBe(503);
			expect(telemetry.gateRejections).toEqual([['unconfigured']]);
		});

		it('writes nothing at all when rate-limited', async () => {
			limiterState.success = false;
			const res = await rpc('tools/list', `Bearer ${token}`);
			expect(res.status).toBe(429);
			expect(telemetry.observed).toHaveLength(0);
			expect(telemetry.gateRejections).toHaveLength(0);
		});

		it('records exactly one observation for an authorised request', async () => {
			await rpc('tools/list', `Bearer ${token}`);
			expect(telemetry.observed).toHaveLength(1);
			expect(telemetry.gateRejections).toHaveLength(0);
		});
	});
});
