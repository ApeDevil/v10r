/**
 * The ONLY module in the MCP tree that imports the database.
 *
 * Everything above it — the transport, the HTTP glue, the pure telemetry helpers — stays free of
 * that edge, which is what lets the protocol tests import the real production path with zero mocks.
 * That boundary is enforced by `http.boundary.gate.test.ts`, not by convention.
 *
 * ## Two failure modes this guards against
 *
 * **A slow insert must not consume the request's budget.** Vercel gives `waitUntil` promises the
 * SAME timeout as the function that spawned them — there is no separate budget — so under load a
 * slow write does not merely risk being dropped, it can time out the function it was meant not to
 * block. Hence the deadline: the write races a timer and is abandoned on expiry.
 *
 * **A write budget bounds the worst case.** The rate limiter is a RATE cap, not a VOLUME cap: at
 * 60 req/min a single IP can legitimately produce ~86k rows a day, and a modest address range
 * multiplies that. A daily ceiling is the only control that makes the worst case bounded rather
 * than merely slow.
 */
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { mcpCallLog } from '$lib/server/db/schema/mcp/call-log';
import { sanitizeError } from '$lib/server/monitoring';

/** Abandon the insert after this. Mirrors the rate limiter's own decision-deadline shape. */
const WRITE_DEADLINE_MS = 500;

/** Sentinel so a timeout is distinguishable from a legitimate result rather than inferred. */
const TIMED_OUT = Symbol('mcp-telemetry-timeout');

export type McpCallLogRow = typeof mcpCallLog.$inferInsert;

/**
 * Insert one row, bounded by a deadline, never throwing.
 *
 * Returns whether the row was written, which the caller may log but must not act on: telemetry is
 * best-effort by construction, and a caller that branches on this would be treating usage analytics
 * as an audit trail.
 */
export async function writeCallLog(row: McpCallLogRow): Promise<boolean> {
	try {
		const raced = await Promise.race([
			db.insert(mcpCallLog).values(row),
			new Promise<typeof TIMED_OUT>((resolve) => setTimeout(() => resolve(TIMED_OUT), WRITE_DEADLINE_MS)),
		]);
		if (raced === TIMED_OUT) {
			console.error('[mcp-telemetry] write exceeded deadline; row dropped');
			return false;
		}
		return true;
	} catch (cause) {
		// sanitizeError reads only `err.message`, discarding the enumerable-property surface a pg
		// DatabaseError would otherwise print — which on a constraint violation includes the
		// offending row values, i.e. the consumer's own query text.
		console.error('[mcp-telemetry] write failed:', sanitizeError(cause));
		return false;
	}
}

/**
 * Count today's rows, for the write budget.
 *
 * Deliberately a cheap indexed count rather than a Redis counter: it needs no second store, it is
 * self-healing across deploys, and at the volumes where the budget matters the index range scan is
 * still far cheaper than the insert it is protecting against.
 */
export async function countRowsToday(): Promise<number> {
	const result = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(mcpCallLog)
		.where(sql`${mcpCallLog.startedAt} >= date_trunc('day', now() at time zone 'utc')`);
	return Number(result[0]?.n ?? 0);
}
