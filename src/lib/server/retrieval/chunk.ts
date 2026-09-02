import { CHUNK_OVERLAP, PARAGRAPH_CHUNK_TARGET, SECTION_CHUNK_TARGET } from './config';
import { planChunks } from './plan';
import type { RawChunk } from './types';

/**
 * Chunk a document into hierarchical parent (section) and child (paragraph) chunks.
 * Thin wrapper over the pure `planChunks` (which the standalone Bun docs-ingestion
 * script also imports) — this side supplies the app's configured chunk sizing.
 */
export async function chunkDocument(content: string): Promise<{
	parents: RawChunk[];
	children: RawChunk[];
}> {
	return planChunks(content, {
		sectionTarget: SECTION_CHUNK_TARGET,
		paragraphTarget: PARAGRAPH_CHUNK_TARGET,
		overlap: CHUNK_OVERLAP,
	});
}
