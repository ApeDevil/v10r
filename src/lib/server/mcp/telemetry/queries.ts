/**
 * Read side of the MCP call log — the queries the operator dashboard is built from.
 *
 * Query-builder only, zero `db.execute()`. That is not stylistic: the neon-serverless pool returns
 * `{ rows }` while PGlite returns a bare array, so a hand-rolled `db.execute` type-checks and then
 * returns nothing on the driver you did not test — which is exactly how a panel ends up
 * permanently, silently empty.
 *
 * Two rules every query here obeys:
 *
 *  1. **Arrivals are `SUM(observed_count)`, never `count(*)`.** Sampled rows carry their multiplier,
 *     so there is exactly one correct way to count.
 *  2. **KPIs filter `traffic = 'external'`.** Preview deployments share the production database and
 *     the operator's own tooling hits the same endpoint; counting either as adoption is the
 *     lie-by-omission this table exists to prevent.
 */
import { and, count, countDistinct, desc, eq, gte, isNotNull, max, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { mcpCallLog } from '$lib/server/db/schema/mcp/call-log';

/** Bounded windows: three cacheable plans instead of an unbounded range scan. */
export type McpWindow = '24h' | '7d' | '30d';

const WINDOW_DAYS: Record<McpWindow, number> = { '24h': 1, '7d': 7, '30d': 30 };

export function windowStart(window: McpWindow, now = new Date()): Date {
	const start = new Date(now);
	start.setDate(start.getDate() - WINDOW_DAYS[window]);
	return start;
}

/**
 * How many DISTINCT callers must have asked a question before its text is shown.
 *
 * Double duty, and it is the reason the caller key survived at all:
 *  - **k-anonymity** over text that may describe a third party's project;
 *  - **anti-poisoning** — without it, the highest-value panel in the design is literally
 *    "attacker-supplied text ranked by attacker-controlled frequency", and anyone with a loop can
 *    make anything the operator's top capability gap.
 */
export const GAP_MIN_DISTINCT_CLIENTS = 3;

const externalOnly = (since: Date) => and(eq(mcpCallLog.traffic, 'external'), gte(mcpCallLog.startedAt, since));

/**
 * THE headline panel: capabilities consumers asked for that the registry could not answer.
 *
 * Ranked by DISTINCT CALLERS, not by row count, and each caller contributes at most one — so
 * repetition by a single client cannot manufacture a gap. Rows below the threshold are suppressed
 * entirely rather than shown with a caveat.
 */
export async function getCapabilityGaps(since: Date, limit = 20) {
	return db
		.select({
			queryText: mcpCallLog.queryText,
			toolName: mcpCallLog.toolName,
			distinctClients: countDistinct(mcpCallLog.clientKey),
			lastSeen: max(mcpCallLog.startedAt),
			registryVersion: max(mcpCallLog.registryVersion),
		})
		.from(mcpCallLog)
		.where(and(externalOnly(since), eq(mcpCallLog.outcome, 'empty'), isNotNull(mcpCallLog.queryText)))
		.groupBy(mcpCallLog.queryText, mcpCallLog.toolName)
		.having(sql`count(distinct ${mcpCallLog.clientKey}) >= ${GAP_MIN_DISTINCT_CLIENTS}`)
		.orderBy(desc(countDistinct(mcpCallLog.clientKey)), desc(max(mcpCallLog.startedAt)))
		.limit(limit);
}

/** How many gap rows were suppressed by the threshold — so the panel can say so honestly. */
export async function countSuppressedGaps(since: Date): Promise<number> {
	const rows = await db
		.select({ queryText: mcpCallLog.queryText })
		.from(mcpCallLog)
		.where(and(externalOnly(since), eq(mcpCallLog.outcome, 'empty'), isNotNull(mcpCallLog.queryText)))
		.groupBy(mcpCallLog.queryText, mcpCallLog.toolName)
		.having(sql`count(distinct ${mcpCallLog.clientKey}) < ${GAP_MIN_DISTINCT_CLIENTS}`);
	return rows.length;
}

/** Per-tool volume and failure mix. Rides the partial tool index. */
export async function getToolBreakdown(since: Date) {
	return db
		.select({
			toolName: mcpCallLog.toolName,
			calls: sql<number>`sum(${mcpCallLog.observedCount})::int`,
			empty: sql<number>`sum(${mcpCallLog.observedCount}) FILTER (WHERE ${mcpCallLog.outcome} = 'empty')::int`,
			invalidArgs: sql<number>`sum(${mcpCallLog.observedCount}) FILTER (WHERE ${mcpCallLog.outcome} = 'invalid_args')::int`,
			notFound: sql<number>`sum(${mcpCallLog.observedCount}) FILTER (WHERE ${mcpCallLog.outcome} = 'not_found')::int`,
			threw: sql<number>`sum(${mcpCallLog.observedCount}) FILTER (WHERE ${mcpCallLog.outcome} = 'threw')::int`,
			// Non-zero means a handler returned isError without a diag — an uninstrumented call site.
			uninstrumented: sql<number>`sum(${mcpCallLog.observedCount}) FILTER (WHERE ${mcpCallLog.outcome} = 'tool_error')::int`,
		})
		.from(mcpCallLog)
		.where(and(externalOnly(since), isNotNull(mcpCallLog.toolName)))
		.groupBy(mcpCallLog.toolName)
		.orderBy(desc(sql`sum(${mcpCallLog.observedCount})`));
}

/**
 * Call volume by stage — an aggregate, NOT a per-consumer funnel.
 *
 * Nothing here can say "the same caller searched and then abandoned": there is no session key, and
 * `trace_id` is per-agent-turn rather than per-consumer. These are independent tallies over the
 * window, and the UI must present them as such (no arrows between bars — a delta between two
 * independent counts asserts a causality this data cannot support).
 */
export async function getStageVolume(since: Date) {
	return db
		.select({
			stage: mcpCallLog.stage,
			outcome: mcpCallLog.outcome,
			calls: sql<number>`sum(${mcpCallLog.observedCount})::int`,
		})
		.from(mcpCallLog)
		.where(externalOnly(since))
		.groupBy(mcpCallLog.stage, mcpCallLog.outcome)
		.orderBy(mcpCallLog.stage);
}

/**
 * One-row health summary, split by traffic source so the KPI strip can show
 * "3 external / 47 your own" rather than a single blended number that flatters the operator.
 */
export async function getHealthSummary(since: Date) {
	const [row] = await db
		.select({
			external: sql<number>`sum(${mcpCallLog.observedCount}) FILTER (WHERE ${mcpCallLog.traffic} = 'external')::int`,
			selfTraffic: sql<number>`sum(${mcpCallLog.observedCount}) FILTER (WHERE ${mcpCallLog.traffic} <> 'external')::int`,
			distinctClients: sql<number>`count(distinct ${mcpCallLog.clientKey}) FILTER (WHERE ${mcpCallLog.traffic} = 'external')::int`,
			// A spec-compliant client probing a capability we do not expose — a feature request.
			unknownMethod: sql<number>`sum(${mcpCallLog.observedCount}) FILTER (WHERE ${mcpCallLog.outcome} = 'unknown_method')::int`,
			// gate_ms > 1000 means the limiter FAIL-OPENED: the rate limit was NOT enforced. A
			// percentile would smooth over exactly this tail event, so it is counted, not averaged.
			failOpen: sql<number>`count(*) FILTER (WHERE ${mcpCallLog.gateMs} > 1000)::int`,
			rateLimitedGate: sql<number>`sum(${mcpCallLog.observedCount}) FILTER (WHERE ${mcpCallLog.outcome} = 'rate_limited')::int`,
			authFailures: sql<number>`sum(${mcpCallLog.observedCount}) FILTER (WHERE ${mcpCallLog.outcome} IN ('unauthorized','unconfigured'))::int`,
		})
		.from(mcpCallLog)
		.where(gte(mcpCallLog.startedAt, since));
	return {
		external: Number(row?.external ?? 0),
		selfTraffic: Number(row?.selfTraffic ?? 0),
		distinctClients: Number(row?.distinctClients ?? 0),
		unknownMethod: Number(row?.unknownMethod ?? 0),
		failOpen: Number(row?.failOpen ?? 0),
		rateLimitedGate: Number(row?.rateLimitedGate ?? 0),
		authFailures: Number(row?.authFailures ?? 0),
	};
}

/**
 * Latency split three ways, per surface.
 *
 * Public dispatch is pure CPU over a static registry (sub-millisecond); `gate_ms` is an Upstash
 * round trip on the path of every request. Pool them and the operator concludes "the MCP is slow"
 * and goes hunting in tool code that is already free. Admin is a genuinely different distribution
 * (its dispatch hits Postgres with a CAS retry loop), hence the per-surface grouping.
 */
export async function getLatency(since: Date) {
	return db
		.select({
			surface: mcpCallLog.surface,
			gateP50: sql<number>`(percentile_cont(0.5) WITHIN GROUP (ORDER BY ${mcpCallLog.gateMs}))::int`,
			gateP95: sql<number>`(percentile_cont(0.95) WITHIN GROUP (ORDER BY ${mcpCallLog.gateMs}))::int`,
			dispatchP50: sql<number>`(percentile_cont(0.5) WITHIN GROUP (ORDER BY ${mcpCallLog.dispatchMs}))::int`,
			dispatchP95: sql<number>`(percentile_cont(0.95) WITHIN GROUP (ORDER BY ${mcpCallLog.dispatchMs}))::int`,
			totalP50: sql<number>`(percentile_cont(0.5) WITHIN GROUP (ORDER BY ${mcpCallLog.totalMs}))::int`,
			totalP95: sql<number>`(percentile_cont(0.95) WITHIN GROUP (ORDER BY ${mcpCallLog.totalMs}))::int`,
			samples: count(),
		})
		.from(mcpCallLog)
		.where(gte(mcpCallLog.startedAt, since))
		.groupBy(mcpCallLog.surface);
}

/**
 * Which client software is calling, and which protocol era.
 *
 * Both values are self-reported and unverified — read as a low-cardinality hint, never as identity.
 * `requested` vs `served` is kept apart deliberately: a client that asks for a version this server
 * does not serve, gets a 400, and falls back would otherwise be indistinguishable from a native
 * caller of the older version, erasing the migration signal at the moment of capture.
 */
export async function getClientBreakdown(since: Date) {
	return db
		.select({
			clientFamily: mcpCallLog.clientFamily,
			requestedProtocolVersion: mcpCallLog.requestedProtocolVersion,
			rcHeaders: mcpCallLog.rcHeaders,
			calls: sql<number>`sum(${mcpCallLog.observedCount})::int`,
		})
		.from(mcpCallLog)
		.where(externalOnly(since))
		.groupBy(mcpCallLog.clientFamily, mcpCallLog.requestedProtocolVersion, mcpCallLog.rcHeaders)
		.orderBy(desc(sql`sum(${mcpCallLog.observedCount})`));
}

/**
 * Callers who asked for a protocol version this server does not support.
 *
 * The single highest-value operational metric during a protocol transition — but it must be read as
 * a PAIR with initialize volume. Under the fallback rules a perfectly healthy modern client
 * produces exactly one 400 per connection by design, so a non-zero count alone is not a fault;
 * a count RISING while initialize volume stays flat is.
 */
export async function getUnsupportedVersionRequests(since: Date) {
	return db
		.select({
			requestedProtocolVersion: mcpCallLog.requestedProtocolVersion,
			clientFamily: mcpCallLog.clientFamily,
			calls: sql<number>`sum(${mcpCallLog.observedCount})::int`,
			lastSeen: max(mcpCallLog.startedAt),
		})
		.from(mcpCallLog)
		.where(and(gte(mcpCallLog.startedAt, since), eq(mcpCallLog.outcome, 'unsupported_version')))
		.groupBy(mcpCallLog.requestedProtocolVersion, mcpCallLog.clientFamily)
		.orderBy(desc(sql`sum(${mcpCallLog.observedCount})`));
}

/** Does the table exist and is it readable? Distinguishes "not provisioned" from "no traffic". */
export async function telemetryReachable(): Promise<boolean> {
	try {
		await db.select({ id: mcpCallLog.id }).from(mcpCallLog).limit(1);
		return true;
	} catch {
		return false;
	}
}
