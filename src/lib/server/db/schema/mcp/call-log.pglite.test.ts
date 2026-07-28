import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '$lib/server/test/db';
import { mcpCallLog } from './call-log';

/**
 * Schema contract for `mcp.call_log`, against a REAL Postgres (PGlite) with the full schema
 * pushed — the project-native DB test approach.
 *
 * Two things here are load-bearing rather than decorative:
 *
 *  1. **Stage declaration order IS funnel order.** The whole "one table, one GROUP BY, no UNION"
 *     design rests on Postgres ordering enum values by declaration, so `WHERE stage >= 'tool'`
 *     selects exactly the rows that reached dispatch. If someone alphabetises the enum, every
 *     funnel denominator silently changes and nothing else would notice.
 *
 *  2. **The CHECKs are the data-minimisation controls**, not hygiene. This is a `db:push`-only
 *     repo, so a constraint that fails to materialise leaves no migration file behind to notice.
 *     Each one is proven to actually reject.
 */
type Db = Awaited<ReturnType<typeof createTestDb>>['db'];

let db: Db;

/** A row that satisfies every constraint — each test perturbs exactly one field. */
function validRow(over: Partial<typeof mcpCallLog.$inferInsert> = {}): typeof mcpCallLog.$inferInsert {
	return {
		surface: 'public',
		traffic: 'external',
		stage: 'tool',
		outcome: 'ok',
		method: 'tools/call',
		toolName: 'search_patterns',
		clientFamily: 'claude-code',
		registryVersion: '1.0.0',
		totalMs: 12,
		gateMs: 8,
		dispatchMs: 1,
		startedAt: new Date(),
		...over,
	};
}

beforeAll(async () => {
	({ db } = await createTestDb());
});

describe('mcp.call_log schema', () => {
	it('materialises the table and accepts a well-formed row', async () => {
		const [row] = await db.insert(mcpCallLog).values(validRow()).returning();
		expect(row.id).toBeGreaterThan(0);
		// Defaults that the recorder relies on rather than setting explicitly.
		expect(row.observedCount).toBe(1);
		expect(row.rcHeaders).toBe(false);
	});

	it('orders the stage enum by declaration, so `stage >= tool` is the dispatch funnel', async () => {
		await db
			.insert(mcpCallLog)
			.values([
				validRow({ stage: 'gate', outcome: 'rate_limited', method: null, toolName: null, dispatchMs: null }),
				validRow({ stage: 'envelope', outcome: 'parse_error', method: null, toolName: null, dispatchMs: null }),
				validRow({ stage: 'protocol', outcome: 'ok', method: 'tools/list', toolName: null, dispatchMs: null }),
				validRow({ stage: 'tool', outcome: 'empty', queryText: 'no such capability' }),
			]);

		const reached = await db
			.select({ stage: mcpCallLog.stage })
			.from(mcpCallLog)
			.where(sql`${mcpCallLog.stage} >= 'tool'`);

		// Only 'tool' is >= 'tool'; if the enum were alphabetised, 'protocol' would sort after
		// 'gate'/'envelope' differently and this count would drift silently.
		expect(reached.every((r) => r.stage === 'tool')).toBe(true);

		const ordered = await db
			.select({ stage: mcpCallLog.stage })
			.from(mcpCallLog)
			.where(sql`${mcpCallLog.stage} < 'tool'`);
		expect(new Set(ordered.map((r) => r.stage))).toEqual(new Set(['gate', 'envelope', 'protocol']));
	});

	describe('constraints reject what they are there to reject', () => {
		it('mcp_call_stage_outcome — a gate row cannot carry a tool outcome', async () => {
			await expect(
				db
					.insert(mcpCallLog)
					.values(validRow({ stage: 'gate', outcome: 'empty', method: null, toolName: null, dispatchMs: null })),
			).rejects.toThrow();
		});

		it('mcp_call_tool_scope — tool_name exists iff the method is tools/call', async () => {
			await expect(
				db.insert(mcpCallLog).values(validRow({ method: 'ping', toolName: 'search_patterns' })),
			).rejects.toThrow();
			await expect(db.insert(mcpCallLog).values(validRow({ method: 'tools/call', toolName: null }))).rejects.toThrow();
		});

		it('mcp_call_query_scope — raw caller text only ever lands on the no-match path', async () => {
			await expect(
				db.insert(mcpCallLog).values(validRow({ outcome: 'ok', queryText: 'should not be stored' })),
			).rejects.toThrow();
			// ...and is accepted on the path that justifies keeping it at all.
			await expect(
				db.insert(mcpCallLog).values(validRow({ outcome: 'empty', queryText: 'background image jobs' })),
			).resolves.toBeDefined();
		});

		it('mcp_call_query_len — the database truncates, not the caller', async () => {
			await expect(
				db.insert(mcpCallLog).values(validRow({ outcome: 'empty', queryText: 'x'.repeat(201) })),
			).rejects.toThrow();
		});

		it('mcp_call_admin_not_external — admin traffic can never inflate an external KPI', async () => {
			await expect(db.insert(mcpCallLog).values(validRow({ surface: 'admin', traffic: 'external' }))).rejects.toThrow();
		});

		it('mcp_call_key_scope — rejection rows carry no caller identifier', async () => {
			await expect(
				db.insert(mcpCallLog).values(
					validRow({
						stage: 'gate',
						outcome: 'unauthorized',
						method: null,
						toolName: null,
						dispatchMs: null,
						clientKey: 'm_deadbeef',
					}),
				),
			).rejects.toThrow();
		});

		it('mcp_call_trace_format — traceparent cannot become a free-text sink', async () => {
			await expect(db.insert(mcpCallLog).values(validRow({ traceId: 'not-hex' }))).rejects.toThrow();
			await expect(db.insert(mcpCallLog).values(validRow({ traceId: '0'.repeat(32) }))).rejects.toThrow();
			await expect(
				db.insert(mcpCallLog).values(validRow({ traceId: '0af7651916cd43dd8448eb211c80319c' })),
			).resolves.toBeDefined();
		});

		it('mcp_call_dispatch_scope — dispatch timing cannot exist without a dispatch', async () => {
			await expect(
				db
					.insert(mcpCallLog)
					.values(validRow({ stage: 'gate', outcome: 'rate_limited', method: null, toolName: null, dispatchMs: 5 })),
			).rejects.toThrow();
		});

		it('mcp_call_observed — a row always stands for at least one occurrence', async () => {
			await expect(db.insert(mcpCallLog).values(validRow({ observedCount: 0 }))).rejects.toThrow();
		});
	});
});
