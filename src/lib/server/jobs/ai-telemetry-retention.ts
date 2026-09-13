import { and, isNotNull, isNull, lt } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { modelCall, toolCall, turn } from '$lib/server/db/schema/ai/turn';
import { retentionCutoff } from '$lib/server/retention';

/**
 * Two-speed retention for the turn trace, in this order so the windows compose:
 *
 *   1. Redact the bodies at 30 days (`ai-turn-bodies`): `turn.blocks`, `turn.history`,
 *      `turn.toolset`, `model_call.request`, `tool_call.result`. The outline — usage,
 *      provider, timings, what was considered/included/cited (ids and sizes) — stays.
 *   2. Delete whole rows at 180 days (`ai-turns`, `ai-model-calls`, `ai-tool-calls`).
 *
 * Minimising by COLUMN first is the point: the prompt bodies and tool I/O are conversation
 * content, the outline is what the admin cost/usage views and the turn inspector's summary
 * read a quarter later. Conversations and their messages are untouched by either pass.
 *
 * Both passes use ABSOLUTE-AGE predicates, so they are idempotent and self-healing: Vercel's
 * ±59-minute cron jitter is irrelevant and a missed week is repaired by the next run. Pass 1
 * marks `redacted_at`, so a re-run over an already-clean window updates nothing. On a weekly
 * cadence the effective windows are 30–37 and 180–187 days.
 *
 * Returns the number of rows AFFECTED (redacted + deleted), which is what the job runner records.
 */
export async function aiTelemetryRetention(): Promise<number> {
	const bodiesCutoff = retentionCutoff('ai-turn-bodies');
	const now = new Date();

	// Pass 1 — column-level minimisation, the three tables in one transaction so an
	// interrupted run leaves whole turns either scrubbed or not. The turn's `redacted_at`
	// restricts the pass to rows that still hold something, so a re-run over an already-clean
	// window updates nothing rather than rewriting the whole range (same guard on the two
	// child tables' body columns).
	const scrubbed = await db.transaction(async (tx) => {
		await tx
			.update(modelCall)
			.set({ request: null })
			.where(and(lt(modelCall.createdAt, bodiesCutoff), isNotNull(modelCall.request)));
		await tx
			.update(toolCall)
			.set({ result: null })
			.where(and(lt(toolCall.createdAt, bodiesCutoff), isNotNull(toolCall.result)));
		return tx
			.update(turn)
			.set({ blocks: null, history: null, toolset: null, redactedAt: now })
			.where(and(lt(turn.createdAt, bodiesCutoff), isNull(turn.redactedAt)))
			.returning({ messageId: turn.messageId });
	});

	// Pass 2 — row-level. Runs second so a row crossing both thresholds in the same week is
	// scrubbed before it is deleted, which keeps the passes independent of execution order.
	// Each table has its own rule so the schedule names every dataset it governs.
	const deletedTools = await db
		.delete(toolCall)
		.where(lt(toolCall.createdAt, retentionCutoff('ai-tool-calls')))
		.returning({ id: toolCall.id });
	const deletedCalls = await db
		.delete(modelCall)
		.where(lt(modelCall.createdAt, retentionCutoff('ai-model-calls')))
		.returning({ id: modelCall.id });
	const deletedTurns = await db
		.delete(turn)
		.where(lt(turn.createdAt, retentionCutoff('ai-turns')))
		.returning({ messageId: turn.messageId });

	return scrubbed.length + deletedTools.length + deletedCalls.length + deletedTurns.length;
}
