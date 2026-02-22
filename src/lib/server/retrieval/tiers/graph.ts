/**
 * Tier 3: Neo4j graph traversal.
 * Seeds from vector search, then expands through entity relationships.
 * Graph hops capped at 2 (non-negotiable).
 */
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { expandViaGraph, getEntitiesForChunks } from '$lib/server/graph/rag/queries';
import type { RankedChunk, RetrievedEntity } from '../types';

/** Vector search for seed chunks (top 3 for graph seeding). */
async function getSeeds(
	queryEmbedding: number[],
	seedCount: number = 3,
): Promise<Array<{ chunkId: string; score: number }>> {
	const embeddingStr = `[${queryEmbedding.join(',')}]`;

	const rows = await db.execute<{ chunkId: string; distance: number }>(sql`
		SELECT
			c.id AS "chunkId",
			c.embedding <=> ${embeddingStr}::vector AS distance
		FROM rag.chunk c
		JOIN rag.document d ON d.id = c.document_id
		WHERE c.embedding IS NOT NULL
		  AND d.status = 'ready'
		  AND d.deleted_at IS NULL
		ORDER BY c.embedding <=> ${embeddingStr}::vector
		LIMIT ${seedCount}
	`);

	return rows.map((r) => ({
		chunkId: r.chunkId,
		score: 1 - Number(r.distance),
	}));
}

/** Fetch chunk content from Postgres by IDs. */
async function fetchChunksByIds(
	chunkIds: string[],
): Promise<Map<string, { documentId: string; documentTitle: string; content: string }>> {
	if (chunkIds.length === 0) return new Map();

	const rows = await db.execute<{
		chunkId: string;
		documentId: string;
		documentTitle: string;
		content: string;
	}>(sql`
		SELECT
			c.id AS "chunkId",
			c.document_id AS "documentId",
			d.title AS "documentTitle",
			COALESCE(c.context_prefix || E'\n' || c.content, c.content) AS content
		FROM rag.chunk c
		JOIN rag.document d ON d.id = c.document_id
		WHERE c.id = ANY(${chunkIds})
	`);

	const map = new Map<string, { documentId: string; documentTitle: string; content: string }>();
	for (const row of rows) {
		map.set(row.chunkId, {
			documentId: row.documentId,
			documentTitle: row.documentTitle,
			content: row.content,
		});
	}
	return map;
}

/** Tier 3: Graph-expanded retrieval — seeds + entity traversal. */
export async function searchGraph(
	queryEmbedding: number[],
	limit: number,
	maxHops: number = 2,
): Promise<RankedChunk[]> {
	// Step 1: Get seed chunks via vector search
	const seeds = await getSeeds(queryEmbedding, 3);
	if (seeds.length === 0) return [];

	const seedIds = seeds.map((s) => s.chunkId);

	// Step 2: Expand via graph traversal
	let graphResults;
	try {
		graphResults = await expandViaGraph(seedIds, Math.min(maxHops, 2));
	} catch {
		// Graph unavailable — graceful degradation to seeds only
		graphResults = [];
	}

	// Step 3: Fetch content for graph-discovered chunks
	const graphChunkIds = graphResults.map((r) => r.pgId);
	const allChunkIds = [...new Set([...seedIds, ...graphChunkIds])];
	const chunkContent = await fetchChunksByIds(allChunkIds);

	// Step 4: Build ranked results
	const results: RankedChunk[] = [];

	// Seeds get their original vector scores
	for (const seed of seeds) {
		const content = chunkContent.get(seed.chunkId);
		if (!content) continue;

		results.push({
			chunkId: seed.chunkId,
			documentId: content.documentId,
			documentTitle: content.documentTitle,
			content: content.content,
			score: seed.score,
			source: 'vector',
			tier: 3,
		});
	}

	// Graph-discovered chunks get a decayed score from their seed
	const bestSeedScore = seeds[0]?.score ?? 0;
	for (const graphResult of graphResults) {
		if (seedIds.includes(graphResult.pgId)) continue; // Skip seeds already added
		const content = chunkContent.get(graphResult.pgId);
		if (!content) continue;

		results.push({
			chunkId: graphResult.pgId,
			documentId: content.documentId,
			documentTitle: content.documentTitle,
			content: content.content,
			score: bestSeedScore * 0.7, // Decay for graph-discovered chunks
			source: 'graph',
			tier: 3,
		});
	}

	return results
		.sort((a, b) => b.score - a.score)
		.slice(0, limit);
}

/** Get entity context for visualization. */
export async function getGraphEntities(
	chunkIds: string[],
): Promise<RetrievedEntity[]> {
	try {
		const entities = await getEntitiesForChunks(chunkIds);
		return entities.map((e) => ({
			name: e.name,
			type: e.type,
			related: e.relatedNames ?? [],
		}));
	} catch {
		return [];
	}
}
