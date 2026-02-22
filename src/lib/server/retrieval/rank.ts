import type { RankedChunk, RetrievedEntity } from './types';
import { RRF_K } from './config';

/**
 * Reciprocal Rank Fusion: combine results from multiple ranked lists.
 * Score = sum(1 / (k + rank)) across all lists containing the chunk.
 */
export function reciprocalRankFusion(
	...lists: RankedChunk[][]
): RankedChunk[] {
	const scores = new Map<string, { chunk: RankedChunk; score: number }>();

	for (const list of lists) {
		for (let rank = 0; rank < list.length; rank++) {
			const chunk = list[rank];
			const rrfScore = 1 / (RRF_K + rank + 1);
			const existing = scores.get(chunk.chunkId);

			if (existing) {
				existing.score += rrfScore;
				// Keep the higher individual score's metadata
				if (chunk.score > existing.chunk.score) {
					existing.chunk = { ...chunk, score: existing.score };
				} else {
					existing.chunk.score = existing.score;
				}
			} else {
				scores.set(chunk.chunkId, { chunk, score: rrfScore });
			}
		}
	}

	return Array.from(scores.values())
		.sort((a, b) => b.score - a.score)
		.map(({ chunk, score }) => ({ ...chunk, score }));
}

/**
 * Deduplicate chunks by ID and cap at maxChunks.
 */
export function deduplicateAndCap(
	chunks: RankedChunk[],
	maxChunks: number,
): RankedChunk[] {
	const seen = new Set<string>();
	const result: RankedChunk[] = [];

	for (const chunk of chunks) {
		if (seen.has(chunk.chunkId)) continue;
		seen.add(chunk.chunkId);
		result.push(chunk);
		if (result.length >= maxChunks) break;
	}

	return result;
}

/**
 * Fuse results from multiple tiers, deduplicate, and cap.
 */
export function fuseAndRank(
	allChunks: RankedChunk[],
	maxChunks: number,
): { chunks: RankedChunk[]; entities: RetrievedEntity[] } {
	// Group by tier for RRF
	const tierGroups = new Map<number, RankedChunk[]>();
	for (const chunk of allChunks) {
		const group = tierGroups.get(chunk.tier) ?? [];
		group.push(chunk);
		tierGroups.set(chunk.tier, group);
	}

	// Sort each tier group by score
	for (const group of tierGroups.values()) {
		group.sort((a, b) => b.score - a.score);
	}

	// Fuse all tier groups
	const lists = Array.from(tierGroups.values());
	const fused = lists.length > 1
		? reciprocalRankFusion(...lists)
		: (lists[0] ?? []).sort((a, b) => b.score - a.score);

	const chunks = deduplicateAndCap(fused, maxChunks);

	return { chunks, entities: [] };
}
