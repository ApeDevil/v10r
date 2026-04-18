/**
 * Shared read helpers for rawrag content.
 * Extracted from tier-specific inline SQL so they can be reused by
 * retrieval tiers, the llmwiki layer, and AI tools (get-rawrag-chunks).
 */
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';

/** A raw chunk with its document context. */
export type RawChunkRow = {
	chunkId: string;
	documentId: string;
	documentTitle: string;
	content: string;
};

/**
 * Fetch chunk content by IDs, user-scoped.
 * Uses COALESCE(context_prefix || content, content) so callers get the
 * contextualized chunk when a prefix exists. Filters out soft-deleted docs
 * and docs owned by a different user.
 */
export async function fetchChunksByIds(chunkIds: string[], userId: string): Promise<Map<string, RawChunkRow>> {
	const map = new Map<string, RawChunkRow>();
	if (chunkIds.length === 0) return map;

	const result = await db.execute<RawChunkRow>(sql`
		SELECT
			c.id AS "chunkId",
			c.document_id AS "documentId",
			d.title AS "documentTitle",
			COALESCE(c.context_prefix || E'\n' || c.content, c.content) AS content
		FROM rag.chunk c
		JOIN rag.document d ON d.id = c.document_id
		WHERE c.id IN (${sql.join(
			chunkIds.map((id) => sql`${id}`),
			sql`, `,
		)})
		  AND d.user_id = ${userId}
		  AND d.deleted_at IS NULL
		  AND d.status = 'ready'
	`);

	for (const row of result.rows) {
		map.set(row.chunkId, {
			chunkId: row.chunkId,
			documentId: row.documentId,
			documentTitle: row.documentTitle,
			content: row.content,
		});
	}
	return map;
}
