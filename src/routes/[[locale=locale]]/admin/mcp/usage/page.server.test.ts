import { describe, expect, it, vi } from 'vitest';

const guards = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
vi.mock('$lib/server/auth/guards', () => guards);

const telemetry = vi.hoisted(() => ({
	reachable: true,
	calls: [] as string[],
}));
vi.mock('$lib/server/mcp/telemetry/queries', () => ({
	GAP_MIN_DISTINCT_CLIENTS: 3,
	RESPONSE_PREVIEW_CHARS: 400,
	windowStart: (w: string) => {
		telemetry.calls.push(`window:${w}`);
		return new Date(0);
	},
	telemetryReachable: async () => telemetry.reachable,
	getHealthSummary: async () => ({
		external: 0,
		selfTraffic: 0,
		distinctClients: 0,
		unknownMethod: 0,
		failOpen: 0,
		rateLimitedGate: 0,
		authFailures: 0,
	}),
	getToolBreakdown: async () => [],
	getStageVolume: async () => [],
	getLatency: async () => [],
	getCapabilityGaps: async () => [],
	countSuppressedGaps: async () => 0,
	getClientBreakdown: async () => [],
	getUnsupportedVersionRequests: async () => [],
	getPrivateSummary: async () => ({
		calls: 0,
		toolCalls: 0,
		withResponse: 0,
		withWorkspace: 0,
		clientKeyed: 0,
		distinctWorkspaces: 0,
	}),
	getPrivateToolMix: async () => [],
	getPrivateCalls: async () => [],
	getPrivateGaps: async () => [],
	getPrivateRequeries: async () => [],
}));

const { load } = await import('./+page.server');

type LoadEvent = Parameters<typeof load>[0];
const event = (search = '') =>
	({ locals: {}, url: new URL(`http://localhost/admin/mcp/usage${search}`) }) as unknown as LoadEvent;

// biome-ignore lint/suspicious/noExplicitAny: narrowing the discriminated union in tests
const loadData = async (e: LoadEvent) => (await load(e)) as any;

describe('/admin/mcp/usage load', () => {
	it('requires an admin', async () => {
		await loadData(event());
		expect(guards.requireAdmin).toHaveBeenCalled();
	});

	it('reports "not provisioned" rather than "no traffic" when the table is unreachable', async () => {
		// These two states look identical on screen — an empty dashboard — and the telemetry writer
		// swallows its own errors by design, so without this probe a missing db:push reads as
		// "nobody used the MCP". That is the wrong conclusion to reach by accident.
		telemetry.reachable = false;
		try {
			const data = await loadData(event());
			expect(data.unavailable).toBe(true);
			// It must not pretend to have numbers it could not read.
			expect(data.health).toBeUndefined();
		} finally {
			telemetry.reachable = true;
		}
	});

	it('serves the dashboard when telemetry is reachable', async () => {
		const data = await loadData(event());
		expect(data.unavailable).toBe(false);
		expect(data.health).toBeDefined();
		expect(data.title).toBe('MCP Usage');
	});

	it('carries the private lane alongside the external panels', async () => {
		const data = await loadData(event());
		expect(data.privateSummary).toBeDefined();
		expect(data.privateToolMix).toEqual([]);
		// The list panels are deferred promises, present whenever the page is reachable.
		expect(data.privateCalls).toBeDefined();
		expect(data.privateGaps).toBeDefined();
		expect(data.privateRequeries).toBeDefined();
	});

	it('omits the private lane when telemetry is unreachable, like everything else', async () => {
		telemetry.reachable = false;
		try {
			const data = await loadData(event());
			expect(data.privateSummary).toBeUndefined();
		} finally {
			telemetry.reachable = true;
		}
	});

	it('accepts only the bounded set of time windows', async () => {
		expect((await loadData(event('?window=24h'))).window).toBe('24h');
		expect((await loadData(event('?window=30d'))).window).toBe('30d');
		// An arbitrary value must fall back rather than reach the query layer.
		expect((await loadData(event('?window=all-time'))).window).toBe('7d');
		expect((await loadData(event())).window).toBe('7d');
	});
});
