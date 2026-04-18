/**
 * Tier 2: Parent-child small-to-big retrieval.
 * Searches small child chunks (paragraph) for precision,
 * then returns their parent chunks (section) for context.
 */
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { OVERFETCH_MULTIPLIER } from '../config';
import { fetchChunksByIds } from '../queries';
import type { RankedChunk } from '../types';

interface ChildHit {
	chunkId: string;
	parentId: string | null;
	documentId: string;
	documentTitle: string;
	content: string;
	distance: number;
	[key: string]: unknown;
}

/** Search child chunks by vector similarity. */
async function searchChildren(queryEmbedding: number[], limit: number, userId: string): Promise<ChildHit[]> {
	const embeddingStr = `[${queryEmbedding.join(',')}]`;

	const result = await db.execute<ChildHit>(sql`
		SELECT
			c.id AS "chunkId",
			c.parent_id AS "parentId",
			c.document_id AS "documentId",
			d.title AS "documentTitle",
			c.content,
			c.embedding <=> ${embeddingStr}::vector AS distance
		FROM rag.chunk c
		JOIN rag.document d ON d.id = c.document_id
		WHERE c.embedding IS NOT NULL
		  AND c.level = 'paragraph'
		  AND c.parent_id IS NOT NULL
		  AND d.status = 'ready'
		  AND d.deleted_at IS NULL
		  AND d.user_id = ${userId}
		ORDER BY c.embedding <=> ${embeddingStr}::vector
		LIMIT ${limit}
	`);
	return result.rows;
}

/** Tier 2: Small-to-big retrieval — search children, return parents. */
export async function searchParentChild(
	queryEmbedding: number[],
	limit: number,
	userId: string,
): Promise<RankedChunk[]> {
	const overfetch = limit * OVERFETCH_MULTIPLIER;
	const childHits = await searchChildren(queryEmbedding, overfetch, userId);

	if (childHits.length === 0) return [];

	// Group children by parent, keep best score per parent
	const parentScores = new Map<string, { bestScore: number; documentId: string; documentTitle: string }>();
	for (const child of childHits) {
		if (!child.parentId) continue;
		const score = 1 - Number(child.distance);
		const existing = parentScores.get(child.parentId);
		if (!existing || score > existing.bestScore) {
			parentScores.set(child.parentId, {
				bestScore: score,
				documentId: child.documentId,
				documentTitle: child.documentTitle,
			});
		}
	}

	// Fetch parent content via shared helper (user-scoped)
	const parentIds = Array.from(parentScores.keys());
	const parents = await fetchChunksByIds(parentIds, userId);

	// Build ranked results using parent content with child's best score
	const results: RankedChunk[] = [];
	for (const [parentId, { bestScore }] of parentScores) {
		const parent = parents.get(parentId);
		if (!parent) continue;

		results.push({
			chunkId: parentId,
			documentId: parent.documentId,
			documentTitle: parent.documentTitle,
			content: parent.content,
			score: bestScore,
			source: 'vector',
			tier: 2,
		});
	}

	return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
