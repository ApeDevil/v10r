import { lt } from 'drizzle-orm';
import { AI_TELEMETRY_RETENTION_DAYS } from '$lib/server/config';
import { db } from '$lib/server/db';
import { conversationStep } from '$lib/server/db/schema/ai/conversation';

/**
 * Trim `ai.conversation_step` — the per-step provider/model/token/duration usage telemetry.
 * It grows unbounded (one row per AI step, only ever inserted), so cap it at
 * AI_TELEMETRY_RETENTION_DAYS. Conversations and their messages are untouched; only the
 * telemetry rows age out (admin cost/usage granularity beyond the window is lost, by design).
 *
 * Returns the number of telemetry rows deleted.
 */
export async function aiTelemetryRetention(): Promise<number> {
	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - AI_TELEMETRY_RETENTION_DAYS);

	const deleted = await db
		.delete(conversationStep)
		.where(lt(conversationStep.createdAt, cutoff))
		.returning({ id: conversationStep.id });

	return deleted.length;
}
