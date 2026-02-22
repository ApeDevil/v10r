import type { RetrievalResult, RetrievalOptions } from './types';
import { generateEmbedding } from './embed';
import { searchContextual } from './tiers/contextual';
import { searchParentChild } from './tiers/parent-child';
import { searchGraph } from './tiers/graph';
import { fuseAndRank } from './rank';
import { MAX_CONTEXT_CHUNKS, MAX_GRAPH_HOPS } from './config';

const DEFAULT_OPTIONS: Required<Omit<RetrievalOptions, 'collectionId' | 'userId'>> = {
	maxChunks: MAX_CONTEXT_CHUNKS,
	tiers: [1],
	graphDepth: MAX_GRAPH_HOPS,
};

/**
 * Retrieve relevant chunks for a query.
 * Single entry point for all retrieval tiers.
 */
export async function retrieve(
	query: string,
	options: RetrievalOptions,
): Promise<RetrievalResult> {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	const start = performance.now();

	// Embed the query (shared across all tiers)
	const queryEmbedding = await generateEmbedding(query);

	// Run requested tiers in parallel
	const tierResults = await Promise.all(
		opts.tiers.map((tier) => {
			switch (tier) {
				case 1:
					return searchContextual(query, queryEmbedding, opts.maxChunks, opts.userId);
				case 2:
					return searchParentChild(queryEmbedding, opts.maxChunks, opts.userId);
				case 3:
					return searchGraph(queryEmbedding, opts.maxChunks, opts.graphDepth, opts.userId);
			}
		}),
	);

	// Fuse, deduplicate, rerank, cap
	const { chunks, entities } = fuseAndRank(
		tierResults.flat(),
		opts.maxChunks,
	);

	return {
		chunks,
		entities,
		tierUsed: opts.tiers,
		durationMs: Math.round(performance.now() - start),
	};
}

/** Format retrieved chunks for injection into an LLM system prompt. */
export function formatContextForPrompt(result: RetrievalResult): string {
	if (result.chunks.length === 0) return '';

	const chunkText = result.chunks
		.map((c, i) => `[${i + 1}] ${c.documentTitle}\n${c.content}`)
		.join('\n\n---\n\n');

	return chunkText;
}
