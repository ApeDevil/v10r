/**
 * Tier 1: Contextual retrieval — pgvector cosine similarity + Postgres BM25.
 * Runs both searches, then fuses results via reciprocal rank fusion.
 */
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import type { ChunkLevel } from '$lib/types/turn-trace';
import { OVERFETCH_MULTIPLIER } from '../config';
import { reciprocalRankFusion } from '../rank';
import type { DocumentSource, RankedChunk } from '../types';
import { sourceScope } from './source-scope';

/** The columns both searches carry beside the score: the chunk's place in its document. */
interface ChunkRow {
	chunkId: string;
	documentId: string;
	documentTitle: string;
	content: string;
	parentId: string | null;
	level: ChunkLevel;
	position: number;
	contentHash: string;
	sourceUri: string | null;
	[key: string]: unknown;
}

interface VectorRow extends ChunkRow {
	distance: number;
}

interface BM25Row extends ChunkRow {
	rank: number;
}

function placeOf(row: ChunkRow): Pick<RankedChunk, 'parentId' | 'level' | 'position' | 'contentHash' | 'sourceUri'> {
	return {
		parentId: row.parentId,
		level: row.level,
		position: Number(row.position),
		contentHash: row.contentHash,
		sourceUri: row.sourceUri,
	};
}

/** Search chunks by vector cosine similarity. */
async function vectorSearch(
	queryEmbedding: number[],
	limit: number,
	userId: string,
	source?: DocumentSource,
): Promise<RankedChunk[]> {
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
				c.parent_id,
				c.level,
				c.position,
				c.content_hash,
				c.embedding <=> ${embeddingStr}::vector AS distance
			FROM retrieval.chunk c
			WHERE c.user_id = ${userId}
			  AND c.embedding IS NOT NULL
			  ${sourceScope(userId, source)}
			ORDER BY distance
			LIMIT ${limit}
		)
		SELECT
			r.chunk_id AS "chunkId",
			r.document_id AS "documentId",
			d.title AS "documentTitle",
			COALESCE(r.context_prefix || E'\n' || r.content, r.content) AS content,
			r.parent_id AS "parentId",
			r.level AS level,
			r.position AS position,
			r.content_hash AS "contentHash",
			d.source_uri AS "sourceUri",
			r.distance AS distance
		FROM ranked r
		JOIN retrieval.document d ON d.id = r.document_id
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
		...placeOf(row),
	}));
}

/** Search chunks by BM25 full-text search. */
async function fullTextSearch(
	query: string,
	limit: number,
	userId: string,
	source?: DocumentSource,
): Promise<RankedChunk[]> {
	const result = await db.execute<BM25Row>(sql`
		WITH ranked AS (
			SELECT
				c.id AS chunk_id,
				c.document_id,
				c.context_prefix,
				c.content,
				c.parent_id,
				c.level,
				c.position,
				c.content_hash,
				ts_rank_cd(c.search_vector, plainto_tsquery('english', ${query})) AS rank
			FROM retrieval.chunk c
			WHERE c.user_id = ${userId}
			  AND c.search_vector @@ plainto_tsquery('english', ${query})
			  ${sourceScope(userId, source)}
			ORDER BY rank DESC
			LIMIT ${limit}
		)
		SELECT
			r.chunk_id AS "chunkId",
			r.document_id AS "documentId",
			d.title AS "documentTitle",
			COALESCE(r.context_prefix || E'\n' || r.content, r.content) AS content,
			r.parent_id AS "parentId",
			r.level AS level,
			r.position AS position,
			r.content_hash AS "contentHash",
			d.source_uri AS "sourceUri",
			r.rank AS rank
		FROM ranked r
		JOIN retrieval.document d ON d.id = r.document_id
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
		...placeOf(row),
	}));
}

/** Tier 1: Contextual hybrid retrieval (vector + BM25 → RRF). */
export async function searchContextual(
	query: string,
	queryEmbedding: number[],
	limit: number,
	userId: string,
	source?: DocumentSource,
): Promise<RankedChunk[]> {
	const overfetch = limit * OVERFETCH_MULTIPLIER;

	const [vectorHits, bm25Hits] = await Promise.all([
		vectorSearch(queryEmbedding, overfetch, userId, source),
		fullTextSearch(query, overfetch, userId, source),
	]);

	// Fuse via reciprocal rank fusion
	const fused = reciprocalRankFusion([vectorHits, bm25Hits], (chunk) => chunk.chunkId);
	return fused.slice(0, limit);
}
