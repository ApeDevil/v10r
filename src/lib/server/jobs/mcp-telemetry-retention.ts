import { and, isNotNull, lt, or, sql } from 'drizzle-orm';
import { MCP_QUERY_TEXT_RETENTION_DAYS, MCP_TELEMETRY_RETENTION_DAYS } from '$lib/server/config';
import { db } from '$lib/server/db';
import { mcpCallLog } from '$lib/server/db/schema/mcp/call-log';

/**
 * Two-speed retention for `mcp.call_log`, in this order so the windows compose:
 *
 *   1. Null the caller-supplied columns (`query_text`, `trace_id`) at 30 days.
 *   2. Delete whole rows at 90 days.
 *
 * Minimising by COLUMN first is the point. The dimensional signal — tool, outcome, latency,
 * registry version — is not personal data and is exactly what makes "did the miss rate for
 * background jobs drop after registry v1.3?" answerable a quarter later. The two columns that could
 * describe a third party are the ones that age out early: retained query text may name someone
 * else's project, and a trace id serves only an incident lookup that nobody will file after a month.
 * Once the first pass has run, a surviving row carries no free text and no identifier at all, which
 * is what makes the longer row window unremarkable rather than something to argue about.
 *
 * ## A property to protect, not an accident
 *
 * Both passes use ABSOLUTE-AGE predicates (`started_at < now() - interval`), so they are idempotent
 * and self-healing: Vercel's ±59-minute cron jitter is irrelevant, and a missed week is fully
 * repaired by the next run. Do NOT "optimise" either pass into a since-the-last-run window — that
 * would trade this property for nothing, and the failure would be silent.
 *
 * On a weekly cadence the EFFECTIVE windows are therefore 30–37 and 90–97 days. Document the upper
 * bound, not the nominal: a retention note claiming a flat "30 days" is wrong by up to a week.
 *
 * Returns the number of rows AFFECTED (nulled + deleted), which is what the job runner records.
 */
export async function mcpTelemetryRetention(): Promise<number> {
	const textCutoff = new Date();
	textCutoff.setDate(textCutoff.getDate() - MCP_QUERY_TEXT_RETENTION_DAYS);

	const rowCutoff = new Date();
	rowCutoff.setDate(rowCutoff.getDate() - MCP_TELEMETRY_RETENTION_DAYS);

	// Pass 1 — column-level minimisation. Restricted to rows that still hold something, so a
	// re-run over an already-clean window updates nothing rather than rewriting the whole range.
	const scrubbed = await db
		.update(mcpCallLog)
		.set({ queryText: null, traceId: null })
		.where(
			and(lt(mcpCallLog.startedAt, textCutoff), or(isNotNull(mcpCallLog.queryText), isNotNull(mcpCallLog.traceId))),
		)
		.returning({ id: mcpCallLog.id });

	// Pass 2 — row-level. Runs second so a row that crosses both thresholds in the same week is
	// scrubbed before it is deleted, which keeps the passes independent of execution order.
	const deleted = await db
		.delete(mcpCallLog)
		.where(lt(mcpCallLog.startedAt, rowCutoff))
		.returning({ id: mcpCallLog.id });

	return scrubbed.length + deleted.length;
}

/** Rows currently holding caller-supplied text — surfaced for the admin jobs view. */
export async function countRetainedQueryText(): Promise<number> {
	const [row] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(mcpCallLog)
		.where(isNotNull(mcpCallLog.queryText));
	return Number(row?.n ?? 0);
}
