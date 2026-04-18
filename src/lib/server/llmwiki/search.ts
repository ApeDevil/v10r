/**
 * Hybrid search over llmwiki pages.
 *
 * Vector search against the TLDR+title+tags embedding.
 * BM25 full-text search against the weighted tsvector (title A, tldr B,
 * body C with 'simple' dict, tags D).
 * Fuse via RRF. Hydrate top-K rawrag pointers per surviving hit.
 */

import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { generateEmbedding } from '$lib/server/rawrag/embed';
import {
	LLMWIKI_OVERFETCH_MULTIPLIER,
	LLMWIKI_RRF_K,
	LLMWIKI_SEARCH_LIMIT,
	POINTER_CAP,
} from './config';
import { LlmwikiError } from './errors';
import { computeCoverage, hydratePointers } from './queries';
import type { LlmwikiHit, LlmwikiSearchOptions } from './types';

export interface RankedPage {
	pageId: string;
	slug: string;
	title: string;
	tldr: string;
	tags: string[];
	score: number;
}

/** Reciprocal rank fusion across vector + BM25 result lists. Exported for unit tests. */
export function rrf(lists: RankedPage[][]): RankedPage[] {
	const scores = new Map<string, RankedPage & { rrfScore: number }>();
	for (const list of lists) {
		for (let rank = 0; rank < list.length; rank++) {
			const page = list[rank];
			const contribution = 1 / (LLMWIKI_RRF_K + rank + 1);
			const existing = scores.get(page.pageId);
			if (existing) {
				existing.rrfScore += contribution;
			} else {
				scores.set(page.pageId, { ...page, rrfScore: contribution });
			}
		}
	}
	return Array.from(scores.values())
		.sort((a, b) => b.rrfScore - a.rrfScore)
		.map((p) => ({ ...p, score: p.rrfScore }));
}

async function vectorHits(
	queryEmbedding: number[],
	userId: string,
	collectionId: string | null | undefined,
	limit: number,
): Promise<RankedPage[]> {
	const embeddingStr = `[${queryEmbedding.join(',')}]`;
	const rows = await db.execute<{
		pageId: string;
		slug: string;
		title: string;
		tldr: string;
		tags: string[];
		distance: number;
	}>(sql`
		SELECT p.id AS "pageId",
		       p.slug AS slug,
		       p.title AS title,
		       p.tldr AS tldr,
		       p.tags AS tags,
		       p.embedding <=> ${embeddingStr}::vector AS distance
		FROM rag.llmwiki_page p
		WHERE p.embedding IS NOT NULL
		  AND p.kind = 'page'
		  AND p.deleted_at IS NULL
		  AND p.user_id = ${userId}
		  ${collectionId === undefined ? sql`` : collectionId === null ? sql`AND p.collection_id IS NULL` : sql`AND p.collection_id = ${collectionId}`}
		ORDER BY p.embedding <=> ${embeddingStr}::vector
		LIMIT ${limit}
	`);
	return rows.rows.map((r) => ({
		pageId: r.pageId,
		slug: r.slug,
		title: r.title,
		tldr: r.tldr,
		tags: r.tags,
		score: 1 - Number(r.distance),
	}));
}

async function bm25Hits(
	query: string,
	userId: string,
	collectionId: string | null | undefined,
	limit: number,
): Promise<RankedPage[]> {
	const rows = await db.execute<{
		pageId: string;
		slug: string;
		title: string;
		tldr: string;
		tags: string[];
		rank: number;
	}>(sql`
		SELECT p.id AS "pageId",
		       p.slug AS slug,
		       p.title AS title,
		       p.tldr AS tldr,
		       p.tags AS tags,
		       ts_rank_cd(p.search_vector, plainto_tsquery('english', ${query})) AS rank
		FROM rag.llmwiki_page p
		WHERE p.search_vector @@ plainto_tsquery('english', ${query})
		  AND p.kind = 'page'
		  AND p.deleted_at IS NULL
		  AND p.user_id = ${userId}
		  ${collectionId === undefined ? sql`` : collectionId === null ? sql`AND p.collection_id IS NULL` : sql`AND p.collection_id = ${collectionId}`}
		ORDER BY rank DESC
		LIMIT ${limit}
	`);
	return rows.rows.map((r) => ({
		pageId: r.pageId,
		slug: r.slug,
		title: r.title,
		tldr: r.tldr,
		tags: r.tags,
		score: Number(r.rank),
	}));
}

/**
 * Search llmwiki pages and hydrate top-K pointers per hit.
 * Primary entry point for the chat retrieval hot path.
 */
export async function searchLlmwiki(query: string, options: LlmwikiSearchOptions): Promise<LlmwikiHit[]> {
	if (!query.trim()) return [];
	const limit = options.limit ?? LLMWIKI_SEARCH_LIMIT;
	const pointerCap = options.pointerCap ?? POINTER_CAP;
	const overfetch = limit * LLMWIKI_OVERFETCH_MULTIPLIER;

	let queryEmbedding: number[];
	try {
		queryEmbedding = await generateEmbedding(query);
	} catch (err) {
		throw new LlmwikiError('search', 'Failed to embed query', err);
	}

	const [vec, bm25] = await Promise.all([
		vectorHits(queryEmbedding, options.userId, options.collectionId, overfetch),
		bm25Hits(query, options.userId, options.collectionId, overfetch),
	]);

	const fused = rrf([vec, bm25]).slice(0, limit);
	if (fused.length === 0) return [];

	const pageIds = fused.map((p) => p.pageId);
	const [pointers, coverage] = await Promise.all([
		hydratePointers(pageIds, options.userId, pointerCap),
		computeCoverage(pageIds, options.userId),
	]);

	return fused.map((p) => ({
		slug: p.slug,
		title: p.title,
		tldr: p.tldr,
		tags: p.tags,
		coverage: coverage.get(p.pageId) ?? { sourceCount: 0, stale: false },
		pointers: pointers.get(p.pageId) ?? [],
	}));
}
