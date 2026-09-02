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
import { type McpCallLogInsert, mcpCallLog } from '$lib/server/db/schema/mcp/call-log';
import { sanitizeError } from '$lib/server/monitoring';

/** Abandon the insert after this. Mirrors the rate limiter's own decision-deadline shape. */
const WRITE_DEADLINE_MS = 500;

/** Sentinel so a timeout is distinguishable from a legitimate result rather than inferred. */
const TIMED_OUT = Symbol('mcp-telemetry-timeout');

/**
 * Describe a failed insert in terms that identify the fault without reprinting the row.
 *
 * The naive `sanitizeError(cause)` is worse than it looks. It reads `err.message`, and Drizzle
 * formats that as `Failed query: <sql>\nparams: <bound values>` — so it prints the whole row while
 * omitting the one field that names the fault, which lives on the pg driver error one level down
 * in `cause`. On a public no-match row those params include the consumer's own query text, so the
 * scrubber's purpose is defeated at the same time as the diagnosis is lost.
 *
 * SQLSTATE plus the constraint name carry no row data and are sufficient on their own: a rejected
 * CHECK names itself. Without them a whole-surface rejection logs only "Failed query: insert into
 * mcp.call_log ...", naming neither the constraint nor the reason — which is how a CHECK can drop
 * every row on one surface unnoticed.
 *
 * `detail`, `where` and `internalQuery` are deliberately NOT read: those are the pg fields that
 * carry offending row values and SQL text.
 */
function describeWriteFailure(cause: unknown): string {
	// Walk the cause chain (Drizzle wraps the driver error). Bounded so a cyclic chain cannot spin.
	let err: unknown = cause;
	for (let depth = 0; err != null && depth < 5; depth++) {
		const candidate = err as { code?: unknown; constraint?: unknown; table?: unknown; cause?: unknown };
		if (typeof candidate.code === 'string') {
			const parts = [`sqlstate=${candidate.code}`];
			if (typeof candidate.constraint === 'string') parts.push(`constraint=${candidate.constraint}`);
			if (typeof candidate.table === 'string') parts.push(`table=${candidate.table}`);
			return parts.join(' ');
		}
		err = candidate.cause;
	}
	// No SQLSTATE — a connection or timeout failure rather than a rejected row. Keep the statement
	// for context but cut Drizzle's `params:` tail, which is the row itself.
	return sanitizeError(cause).split('\nparams:')[0];
}

/**
 * Insert one row, bounded by a deadline, never throwing.
 *
 * Returns whether the row was written, which the caller may log but must not act on: telemetry is
 * best-effort by construction, and a caller that branches on this would be treating usage analytics
 * as an audit trail.
 */
export async function writeCallLog(row: McpCallLogInsert): Promise<boolean> {
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
		// SQLSTATE + constraint name, never the row. See describeWriteFailure for why the obvious
		// `sanitizeError(cause)` both leaks the parameters and hides the reason.
		console.error('[mcp-telemetry] write failed:', describeWriteFailure(cause));
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
