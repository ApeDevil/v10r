/**
 * Graph store: persist entities and relationships to Neo4j.
 */
import {
	batchCreateChunks,
	batchCreateHasChild,
	batchCreateNextChunk,
	storeDocumentGraph,
} from '$lib/server/graph/rag/mutations';
import type { RawChunk } from '../types';
import type { ExtractionResult } from './entity-extract';

/**
 * Store chunk structure in Neo4j (HAS_CHILD + NEXT_CHUNK edges).
 */
export async function storeChunkStructure(
	documentId: string,
	parents: RawChunk[],
	children: RawChunk[],
): Promise<void> {
	// Batch all chunk nodes in one call
	const allChunks = [...parents, ...children].map((c) => ({
		pgId: c.id,
		documentId,
		level: c.level,
	}));
	await batchCreateChunks(allChunks);

	// Batch HAS_CHILD edges
	const hasChildEdges = children
		.filter((c) => c.parentId)
		.map((c) => ({
			parentPgId: c.parentId ?? '',
			childPgId: c.id,
			position: c.position,
		}));
	await batchCreateHasChild(hasChildEdges);

	// Batch NEXT_CHUNK edges (within same level)
	const byLevel = new Map<string, RawChunk[]>();
	for (const chunk of [...parents, ...children]) {
		const group = byLevel.get(chunk.level) ?? [];
		group.push(chunk);
		byLevel.set(chunk.level, group);
	}

	const nextEdges: Array<{ fromPgId: string; toPgId: string }> = [];
	for (const group of byLevel.values()) {
		const sorted = group.sort((a, b) => a.position - b.position);
		for (let i = 0; i < sorted.length - 1; i++) {
			nextEdges.push({ fromPgId: sorted[i].id, toPgId: sorted[i + 1].id });
		}
	}
	await batchCreateNextChunk(nextEdges);
}

/**
 * Store extracted entities and relationships in Neo4j.
 * Links entities to their source chunks via MENTIONS edges.
 */
export async function storeEntitiesAndRelationships(
	extraction: ExtractionResult,
	chunkEntityMap: Array<{ chunkPgId: string; entityName: string; confidence: number }>,
): Promise<{ entityCount: number; relationshipCount: number }> {
	return storeDocumentGraph(
		extraction.entities,
		extraction.relationships.map((r) => ({
			sourceName: r.source,
			targetName: r.target,
			type: r.type,
			weight: r.weight,
		})),
		chunkEntityMap,
	);
}
