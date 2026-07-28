import { beforeAll, describe, expect, it, vi } from 'vitest';
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

const { getCapabilityGaps, countSuppressedGaps, getHealthSummary, getToolBreakdown, telemetryReachable } = await import(
	'./queries'
);

let db: Db;
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
	({ db } = await createTestDb());
	holder.db = db;
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
		const { db: freshDb } = await createTestDb();
		holder.db = freshDb;
		await freshDb.insert(mcpCallLog).values([
			{ ...gapRow('m_1', 'a'), traffic: 'external' as const },
			{ ...gapRow('m_2', 'b'), traffic: 'self' as const },
			{ ...gapRow('m_3', 'c'), traffic: 'preview' as const },
		]);

		const summary = await getHealthSummary(SINCE);
		expect(summary.external).toBe(1);
		// Both `self` and `preview` are the operator's own noise — neither may count as adoption.
		expect(summary.selfTraffic).toBe(2);
		holder.db = db;
	});

	it('counts fail-open windows rather than averaging them away', async () => {
		const { db: freshDb } = await createTestDb();
		holder.db = freshDb;
		await freshDb.insert(mcpCallLog).values([
			{ ...gapRow('m_1', 'a'), gateMs: 5 },
			// gate_ms > 1000 means the limiter fail-opened: the rate limit was NOT enforced.
			{ ...gapRow('m_2', 'b'), gateMs: 1500, totalMs: 1500 },
		]);
		expect((await getHealthSummary(SINCE)).failOpen).toBe(1);
		holder.db = db;
	});
});

describe('tool breakdown', () => {
	it('counts arrivals with SUM(observed_count), not count(*)', async () => {
		const { db: freshDb } = await createTestDb();
		holder.db = freshDb;
		// One row standing for five sampled occurrences.
		await freshDb.insert(mcpCallLog).values({ ...gapRow('m_1', 'x'), observedCount: 5 });
		const [row] = await getToolBreakdown(SINCE);
		expect(Number(row.calls)).toBe(5);
		holder.db = db;
	});
});

describe('reachability probe', () => {
	it('reports true when the table is provisioned', async () => {
		expect(await telemetryReachable()).toBe(true);
	});
});
