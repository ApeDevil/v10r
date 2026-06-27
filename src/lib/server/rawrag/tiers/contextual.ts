/**
 * Tier 1: Contextual retrieval — pgvector cosine similarity + Postgres BM25.
 * Runs both searches, then fuses results via reciprocal rank fusion.
 */
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { OVERFETCH_MULTIPLIER } from '../config';
import { reciprocalRankFusion } from '../rank';
import type { RankedChunk } from '../types';

interface VectorRow {
	chunkId: string;
	documentId: string;
	documentTitle: string;
	content: string;
	distance: number;
	[key: string]: unknown;
}

interface BM25Row {
	chunkId: string;
	documentId: string;
	documentTitle: string;
	content: string;
	rank: number;
	[key: string]: unknown;
}

/** Search chunks by vector cosine similarity. */
async function vectorSearch(queryEmbedding: number[], limit: number, userId: string): Promise<RankedChunk[]> {
	const embeddingStr = `[${queryEmbedding.join(',')}]`;

	// HNSW-friendly shape: filter + order on the chunk row only (so the index is
	// usable), compute the distance once via a CTE alias, then join document for
	// the title on the LIMITed set.
	const result = await db.execute<VectorRow>(sql`
		WITH ranked AS (
			SELECT
				c.id AS chunk_id,
				c.document_id,
				c.context_prefix,
				c.content,
				c.embedding <=> ${embeddingStr}::vector AS distance
			FROM rag.chunk c
			WHERE c.user_id = ${userId}
			  AND c.embedding IS NOT NULL
			ORDER BY distance
			LIMIT ${limit}
		)
		SELECT
			r.chunk_id AS "chunkId",
			r.document_id AS "documentId",
			d.title AS "documentTitle",
			COALESCE(r.context_prefix || E'\n' || r.content, r.content) AS content,
			r.distance AS distance
		FROM ranked r
		JOIN rag.document d ON d.id = r.document_id
		ORDER BY r.distance
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
async function fullTextSearch(query: string, limit: number, userId: string): Promise<RankedChunk[]> {
	const result = await db.execute<BM25Row>(sql`
		WITH ranked AS (
			SELECT
				c.id AS chunk_id,
				c.document_id,
				c.context_prefix,
				c.content,
				ts_rank_cd(c.search_vector, plainto_tsquery('english', ${query})) AS rank
			FROM rag.chunk c
			WHERE c.user_id = ${userId}
			  AND c.search_vector @@ plainto_tsquery('english', ${query})
			ORDER BY rank DESC
			LIMIT ${limit}
		)
		SELECT
			r.chunk_id AS "chunkId",
			r.document_id AS "documentId",
			d.title AS "documentTitle",
			COALESCE(r.context_prefix || E'\n' || r.content, r.content) AS content,
			r.rank AS rank
		FROM ranked r
		JOIN rag.document d ON d.id = r.document_id
		ORDER BY r.rank DESC
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
