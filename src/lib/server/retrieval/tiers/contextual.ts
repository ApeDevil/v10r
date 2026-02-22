/**
 * Tier 1: Contextual retrieval — pgvector cosine similarity + Postgres BM25.
 * Runs both searches, then fuses results via reciprocal rank fusion.
 */
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import type { RankedChunk } from '../types';
import { reciprocalRankFusion } from '../rank';
import { OVERFETCH_MULTIPLIER } from '../config';

interface VectorRow {
	chunkId: string;
	documentId: string;
	documentTitle: string;
	content: string;
	distance: number;
}

interface BM25Row {
	chunkId: string;
	documentId: string;
	documentTitle: string;
	content: string;
	rank: number;
}

/** Search chunks by vector cosine similarity. */
async function vectorSearch(
	queryEmbedding: number[],
	limit: number,
	userId: string,
): Promise<RankedChunk[]> {
	const embeddingStr = `[${queryEmbedding.join(',')}]`;

	const result = await db.execute<VectorRow>(sql`
		SELECT
			c.id AS "chunkId",
			c.document_id AS "documentId",
			d.title AS "documentTitle",
			COALESCE(c.context_prefix || E'\n' || c.content, c.content) AS content,
			c.embedding <=> ${embeddingStr}::vector AS distance
		FROM rag.chunk c
		JOIN rag.document d ON d.id = c.document_id
		WHERE c.embedding IS NOT NULL
		  AND d.status = 'ready'
		  AND d.deleted_at IS NULL
		  AND d.user_id = ${userId}
		ORDER BY c.embedding <=> ${embeddingStr}::vector
		LIMIT ${limit}
	`);

	return result.rows.map((row) => ({
		chunkId: row.chunkId,
		documentId: row.documentId,
		documentTitle: row.documentTitle,
		content: row.content,
		score: 1 - Number(row.distance), // cosine distance → similarity
		source: 'vector' as const,
		tier: 1 as const,
	}));
}

/** Search chunks by BM25 full-text search. */
async function fullTextSearch(
	query: string,
	limit: number,
	userId: string,
): Promise<RankedChunk[]> {
	const result = await db.execute<BM25Row>(sql`
		SELECT
			c.id AS "chunkId",
			c.document_id AS "documentId",
			d.title AS "documentTitle",
			COALESCE(c.context_prefix || E'\n' || c.content, c.content) AS content,
			ts_rank_cd(c.search_vector, plainto_tsquery('english', ${query})) AS rank
		FROM rag.chunk c
		JOIN rag.document d ON d.id = c.document_id
		WHERE c.search_vector @@ plainto_tsquery('english', ${query})
		  AND d.status = 'ready'
		  AND d.deleted_at IS NULL
		  AND d.user_id = ${userId}
		ORDER BY rank DESC
		LIMIT ${limit}
	`);

	return result.rows.map((row) => ({
		chunkId: row.chunkId,
		documentId: row.documentId,
		documentTitle: row.documentTitle,
		content: row.content,
		score: Number(row.rank),
		source: 'bm25' as const,
		tier: 1 as const,
	}));
}

/** Tier 1: Contextual hybrid retrieval (vector + BM25 → RRF). */
export async function searchContextual(
	query: string,
	queryEmbedding: number[],
	limit: number,
	userId: string,
): Promise<RankedChunk[]> {
	const overfetch = limit * OVERFETCH_MULTIPLIER;

	const [vectorHits, bm25Hits] = await Promise.all([
		vectorSearch(queryEmbedding, overfetch, userId),
		fullTextSearch(query, overfetch, userId),
	]);

	// Fuse via reciprocal rank fusion
	const fused = reciprocalRankFusion(vectorHits, bm25Hits);
	return fused.slice(0, limit);
}
