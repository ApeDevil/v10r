/**
 * A retrieved chunk's place, in the trace's vocabulary: where it sits in its document
 * (parent, level, position), which retriever produced it, the body hash the reader
 * checks for drift, and the document's canonical path. One projection, shared by every
 * lane that records `RankedChunk`s as grounding items — the docs prefetch and the desk
 * search — so a chunk reads the same whichever corpus it came from.
 *
 * Only the fields the retriever filled are written: a tier the kernel has not taught
 * yet (parent-child, graph) leaves them absent, which the inspector reads as "not recorded".
 */
import type { RankedChunk } from '$lib/server/retrieval';
import type { GroundingItem } from '$lib/types/turn-trace';

export type ChunkPlace = Pick<GroundingItem, 'parentId' | 'level' | 'position' | 'contentHash' | 'retriever' | 'path'>;

export function chunkPlace(chunk: RankedChunk): ChunkPlace {
	const place: ChunkPlace = { retriever: `tier-${chunk.tier}` };
	if (chunk.parentId) place.parentId = chunk.parentId;
	if (chunk.level) place.level = chunk.level;
	if (chunk.position !== undefined) place.position = chunk.position;
	if (chunk.contentHash) place.contentHash = chunk.contentHash;
	if (chunk.sourceUri?.startsWith('/')) place.path = chunk.sourceUri;
	return place;
}
