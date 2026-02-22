/**
 * Graph store: persist entities and relationships to Neo4j.
 */
import {
	createChunkNode,
	createHasChild,
	createNextChunk,
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
	// Create parent chunk nodes
	for (const parent of parents) {
		await createChunkNode(parent.id, documentId, parent.level);
	}

	// Create child chunk nodes + HAS_CHILD edges
	for (const child of children) {
		await createChunkNode(child.id, documentId, child.level);
		if (child.parentId) {
			await createHasChild(child.parentId, child.id, child.position);
		}
	}

	// Create NEXT_CHUNK edges for sequential ordering (within same level)
	const byLevel = new Map<string, RawChunk[]>();
	for (const chunk of [...parents, ...children]) {
		const key = `${chunk.level}`;
		const group = byLevel.get(key) ?? [];
		group.push(chunk);
		byLevel.set(key, group);
	}

	for (const group of byLevel.values()) {
		const sorted = group.sort((a, b) => a.position - b.position);
		for (let i = 0; i < sorted.length - 1; i++) {
			await createNextChunk(sorted[i].id, sorted[i + 1].id);
		}
	}
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
