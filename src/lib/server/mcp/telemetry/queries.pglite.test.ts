import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mcpCallLog } from '$lib/server/db/schema/mcp/call-log';
import { createTestDb } from '$lib/server/test/db';

/**
 * The dashboard queries against a REAL Postgres.
 *
 * Two behaviours here are load-bearing and would be invisible in a unit test with a fake db:
 *
 *  1. **The >=3-distinct-caller threshold.** It is simultaneously the k-anonymity control over
 *     third-party text and the anti-poisoning control for the highest-value panel in the design.
 *     Without it, "capability gaps" is attacker-supplied text ranked by attacker-controlled
 *     frequency, and one caller with a loop decides what the operator works on next.
 *  2. **`traffic = 'external'` on every KPI.** Preview deployments share the production database
 *     and the operator's own tooling hits the same endpoint, so a missing filter does not error —
 *     it silently reports the operator's dogfooding as third-party adoption.
 */
type Db = Awaited<ReturnType<typeof createTestDb>>['db'];
type Client = Awaited<ReturnType<typeof createTestDb>>['client'];

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('$lib/server/db', () => ({
	db: new Proxy(
		{},
		{
			get(_t, prop) {
				if (typeof prop === 'symbol') return undefined;
				const target = holder.db as Record<string, unknown> | null;
				const value = target?.[prop];
				return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
			},
		},
	),
}));

const {
	getCapabilityGaps,
	countSuppressedGaps,
	getClientBreakdown,
	getHealthSummary,
	getPrivateCalls,
	getPrivateGaps,
	getPrivateRequeries,
	getPrivateSummary,
	getPrivateToolMix,
	getToolBreakdown,
	telemetryReachable,
} = await import('./queries');

let db: Db;
let client: Client;
const SINCE = new Date(Date.now() - 60 * 60 * 1000);

/** A tool-stage row; caller and query text vary per test. */
function gapRow(clientKey: string, queryText: string) {
	return {
		surface: 'public' as const,
		traffic: 'external' as const,
		stage: 'tool' as const,
		outcome: 'empty' as const,
		method: 'tools/call' as const,
		toolName: 'search_patterns',
		queryText,
		clientFamily: 'claude-code',
		clientKey,
		registryVersion: '1.0.0',
		totalMs: 10,
		gateMs: 8,
		dispatchMs: 1,
		startedAt: new Date(),
	};
}

beforeAll(async () => {
	({ db, client } = await createTestDb());
	holder.db = db;
});

/**
 * Every test here reads through the same `mcp.call_log`, so emptying the table gives the same
 * isolation a fresh database would — at ~1ms instead of the ~1.2s (much more under a loaded pool)
 * of booting PGlite and re-pushing all 437 schema statements.
 */
beforeEach(async () => {
	await client.exec('DELETE FROM mcp.call_log');
});

describe('capability gaps — the headline panel', () => {
	it('suppresses a query until at least three DISTINCT callers have asked it', async () => {
		// Two callers, but one of them repeats ten times. Frequency alone must not surface it.
		await db
			.insert(mcpCallLog)
			.values([
				...Array.from({ length: 10 }, () => gapRow('m_loop', 'multi tenant billing')),
				gapRow('m_second', 'multi tenant billing'),
			]);

		expect(await getCapabilityGaps(SINCE)).toHaveLength(0);
		expect(await countSuppressedGaps(SINCE)).toBe(1);

		// A third independent caller crosses the threshold.
		await db.insert(mcpCallLog).values(gapRow('m_third', 'multi tenant billing'));
		const gaps = await getCapabilityGaps(SINCE);
		expect(gaps).toHaveLength(1);
		expect(gaps[0].queryText).toBe('multi tenant billing');
		// Ranked by distinct callers — the ten repeats from one key still count once.
		expect(Number(gaps[0].distinctClients)).toBe(3);
	});

	it('ranks by distinct callers, so volume from one client cannot outrank real demand', async () => {
		await db.insert(mcpCallLog).values([
			...Array.from({ length: 50 }, () => gapRow('m_spammer', 'attacker chosen topic')),
			gapRow('m_a', 'attacker chosen topic'),
			gapRow('m_b', 'attacker chosen topic'),
			// A genuinely broader ask: four different callers, one call each.
			gapRow('m_p', 'video transcoding'),
			gapRow('m_q', 'video transcoding'),
			gapRow('m_r', 'video transcoding'),
			gapRow('m_s', 'video transcoding'),
		]);

		const gaps = await getCapabilityGaps(SINCE);
		const ranked = gaps.map((g) => g.queryText);
		expect(ranked.indexOf('video transcoding')).toBeLessThan(ranked.indexOf('attacker chosen topic'));
	});

	it('never surfaces non-external traffic as a gap', async () => {
		await db
			.insert(mcpCallLog)
			.values(['m_x', 'm_y', 'm_z'].map((k) => ({ ...gapRow(k, 'operator only probe'), traffic: 'self' as const })));
		const gaps = await getCapabilityGaps(SINCE);
		expect(gaps.map((g) => g.queryText)).not.toContain('operator only probe');
	});
});

describe('health summary', () => {
	it('splits external from self-traffic instead of blending them', async () => {
		await db.insert(mcpCallLog).values([
			{ ...gapRow('m_1', 'a'), traffic: 'external' as const },
			{ ...gapRow('m_2', 'b'), traffic: 'self' as const },
			{ ...gapRow('m_3', 'c'), traffic: 'preview' as const },
		]);

		const summary = await getHealthSummary(SINCE);
		expect(summary.external).toBe(1);
		// Both `self` and `preview` are the operator's own noise — neither may count as adoption.
		expect(summary.selfTraffic).toBe(2);
	});

	it('counts fail-open windows rather than averaging them away', async () => {
		await db.insert(mcpCallLog).values([
			{ ...gapRow('m_1', 'a'), gateMs: 5 },
			// gate_ms > 1000 means the limiter fail-opened: the rate limit was NOT enforced.
			{ ...gapRow('m_2', 'b'), gateMs: 1500, totalMs: 1500 },
		]);
		expect((await getHealthSummary(SINCE)).failOpen).toBe(1);
	});
});

describe('tool breakdown', () => {
	it('counts arrivals with SUM(observed_count), not count(*)', async () => {
		// One row standing for five sampled occurrences.
		await db.insert(mcpCallLog).values({ ...gapRow('m_1', 'x'), observedCount: 5 });
		const [row] = await getToolBreakdown(SINCE);
		expect(Number(row.calls)).toBe(5);
	});
});

describe('the private lane', () => {
	/** A private tool row — bearer-gated surface, so traffic is never 'external'. */
	function privateRow(over: Partial<typeof mcpCallLog.$inferInsert> = {}): typeof mcpCallLog.$inferInsert {
		return {
			surface: 'private',
			traffic: 'self',
			stage: 'tool',
			outcome: 'ok',
			method: 'tools/call',
			toolName: 'search_patterns',
			queryText: 'background jobs',
			responseText: '# Match\n\nUse the jobs pattern.',
			workspace: 'densho',
			clientFamily: 'claude-code',
			clientKey: 'm_operator',
			registryVersion: '1.0.0',
			totalMs: 10,
			gateMs: 8,
			dispatchMs: 1,
			startedAt: new Date(),
			...over,
		};
	}

	it('surfaces a gap asked ONCE by ONE caller — the exact inverse of the public threshold', async () => {
		await db.insert(mcpCallLog).values(privateRow({ outcome: 'empty', queryText: 'quantum scheduler' }));

		const gaps = await getPrivateGaps(SINCE);
		expect(gaps).toHaveLength(1);
		expect(gaps[0].queryText).toBe('quantum scheduler');
		// ...while the public panel, correctly, still shows nothing: not external, and n=1.
		expect(await getCapabilityGaps(SINCE)).toHaveLength(0);
	});

	it('lists recent calls with the bounded answer preview and workspace, newest first', async () => {
		const now = Date.now();
		await db.insert(mcpCallLog).values([
			privateRow({ startedAt: new Date(now - 60_000), queryText: 'older question' }),
			privateRow({
				startedAt: new Date(now - 1_000),
				queryText: 'newer question',
				responseText: 'x'.repeat(900),
			}),
			// A public row that must not appear in the private list.
			{ ...gapRow('m_ext', 'public question'), startedAt: new Date(now - 500) },
		]);

		const calls = await getPrivateCalls(SINCE);
		expect(calls).toHaveLength(2);
		expect(calls[0].queryText).toBe('newer question');
		expect(calls[0].workspace).toBe('densho');
		// The page payload carries the preview, never the full column.
		expect(calls[0].responsePreview).toHaveLength(400);
		expect(Number(calls[0].responseChars)).toBe(900);
	});

	it('finds a repeat ask within 30s, not one 60s apart, and nothing without a client key', async () => {
		const now = Date.now();
		await db.insert(mcpCallLog).values([
			privateRow({ startedAt: new Date(now - 70_000), queryText: 'first ask' }),
			// 10s after a previous same-tool call → a repeat.
			privateRow({ startedAt: new Date(now - 60_000), queryText: 'repeat ask' }),
			// 60s gap back to the previous one → not a repeat.
			privateRow({ startedAt: new Date(now), queryText: 'patient ask' }),
		]);

		const requeries = await getPrivateRequeries(SINCE);
		expect(requeries).toHaveLength(1);
		expect(requeries[0].queryText).toBe('repeat ask');

		// With the salt unset every client_key is null and the probe has nothing to join on.
		// Clear the keyed rows above so the assertion below can only be satisfied by the null keys.
		await client.exec('DELETE FROM mcp.call_log');
		await db
			.insert(mcpCallLog)
			.values([
				privateRow({ clientKey: null, startedAt: new Date(now - 10_000) }),
				privateRow({ clientKey: null, startedAt: new Date(now - 5_000) }),
			]);
		expect(await getPrivateRequeries(SINCE)).toHaveLength(0);
	});

	it('tool mix counts with SUM(observed_count) and reports answer coverage', async () => {
		await db.insert(mcpCallLog).values([privateRow({ observedCount: 5 }), privateRow({ responseText: null })]);
		const [mix] = await getPrivateToolMix(SINCE);
		expect(Number(mix.calls)).toBe(6);
		expect(Number(mix.withResponse)).toBe(1);
	});

	it('summary counts the lane and its salt coverage', async () => {
		await db.insert(mcpCallLog).values([privateRow(), privateRow({ clientKey: null, workspace: null })]);
		const summary = await getPrivateSummary(SINCE);
		expect(summary.calls).toBe(2);
		expect(summary.toolCalls).toBe(2);
		expect(summary.withResponse).toBe(2);
		expect(summary.withWorkspace).toBe(1);
		expect(summary.clientKeyed).toBe(1);
		expect(summary.distinctWorkspaces).toBe(1);
	});

	it('never leaks a private row into the external panels', async () => {
		await db.insert(mcpCallLog).values(privateRow({ outcome: 'empty', queryText: 'private only' }));
		expect(await getToolBreakdown(SINCE)).toHaveLength(0);
		expect(await getClientBreakdown(SINCE)).toHaveLength(0);
		expect(await getCapabilityGaps(SINCE)).toHaveLength(0);
	});
});

describe('reachability probe', () => {
	it('reports true when the table is provisioned', async () => {
		expect(await telemetryReachable()).toBe(true);
	});
});
