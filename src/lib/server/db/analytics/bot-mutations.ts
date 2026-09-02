/**
 * Write chokepoint for the bot lane — a batch INSERT of already-verified rows.
 *
 * Rows arrive from the Redis buffer (`analytics/bot-hit-buffer.ts`) with their verdict
 * and their original timestamp. Nothing here computes anything: the per-hit INSERT that
 * used to carry the CIDR containment test is gone, because it woke the database on every
 * crawler request.
 */

import { db } from '$lib/server/db';
import { type BotHitInsert, botHits } from '$lib/server/db/schema/analytics/bot-hits';

/** 8 columns × 500 rows sits well under the 65,535-parameter ceiling. */
const INSERT_CHUNK = 500;

export async function insertBotHits(rows: BotHitInsert[]): Promise<number> {
	for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
		await db.insert(botHits).values(rows.slice(i, i + INSERT_CHUNK));
	}
	return rows.length;
}
