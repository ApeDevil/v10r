import { RRF_K } from './config';
import type { RankedChunk } from './types';

/**
 * Reciprocal Rank Fusion: combine several ranked lists into one.
 * Score = sum(1 / (k + rank)) across every list containing the item.
 *
 * Generic over the item because the wiki layer fuses pages by `pageId` while the chunk
 * layer fuses by `chunkId` — one implementation, two identity functions. `identify` is
 * the only thing that differed between the two copies this replaces.
 *
 * Two properties are load-bearing and were both violated by the previous implementation:
 *
 *  1. **Inputs are never mutated.** The map holds the first-seen item by reference and the
 *     accumulated score beside it; the only write is the spread on the way out. Callers
 *     group their own arrays into these lists (`fuseAndRank` does), so writing through an
 *     item here would rewrite the caller's data.
 *  2. **Metadata is first-seen, not "best".** A duplicate id means the SAME document found
 *     by two retrievers, so there is no better copy to choose — and a rule that picks one
 *     is a rule that can be wrong. Anything downstream that needs to know which lists an
 *     item came from must track that itself, because fusion collapses it.
 */
export function reciprocalRankFusion<T extends { score: number }>(
	lists: readonly T[][],
	identify: (item: T) => string,
): T[] {
	const fused = new Map<string, { item: T; score: number }>();

	for (const list of lists) {
		for (let rank = 0; rank < list.length; rank++) {
			const item = list[rank];
			const contribution = 1 / (RRF_K + rank + 1);
			const existing = fused.get(identify(item));

			if (existing) {
				existing.score += contribution;
			} else {
				fused.set(identify(item), { item, score: contribution });
			}
		}
	}

	return Array.from(fused.values())
		.sort((a, b) => b.score - a.score)
		.map(({ item, score }) => ({ ...item, score }));
}

/**
 * Deduplicate chunks by ID and cap at maxChunks.
 */
export function deduplicateAndCap(chunks: RankedChunk[], maxChunks: number): RankedChunk[] {
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
export function fuseAndRank(allChunks: RankedChunk[], maxChunks: number): { chunks: RankedChunk[] } {
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
	const fused =
		lists.length > 1
			? reciprocalRankFusion(lists, (chunk) => chunk.chunkId)
			: (lists[0] ?? []).sort((a, b) => b.score - a.score);

	const chunks = deduplicateAndCap(fused, maxChunks);

	return { chunks };
}
