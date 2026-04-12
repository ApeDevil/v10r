import type { KnowledgeData } from '$lib/types/knowledge';
import { cypher } from '../index';
import type { Neo4jNodeRecord, Neo4jRelRecord } from '../types';
import { toKnowledgeData } from '../types';

interface GraphChunkResult {
	pgId: string;
	entityName: string;
	entityType: string;
	relType: string;
}

/**
 * Expand from seed chunk IDs through entity relationships.
 * Returns chunk pgIds discovered via graph traversal (max 2 hops).
 */
const HOP_PATTERNS: Record<number, string> = { 1: '*1..1', 2: '*1..2' };

export async function expandViaGraph(seedChunkIds: string[], maxHops: number = 2): Promise<GraphChunkResult[]> {
	const hops = Math.min(maxHops, 2); // Hard cap at 2
	const hopPattern = HOP_PATTERNS[hops];
	if (!hopPattern) throw new Error(`Invalid hops value: ${hops}. Must be 1 or 2.`);

	return cypher<GraphChunkResult>(
		`UNWIND $seedChunkIds AS seedId
		 MATCH (seed:Chunk {pgId: seedId})-[:MENTIONS]->(e:Entity)
		 MATCH (e)-[:RELATED_TO${hopPattern}]->(related:Entity)
		 MATCH (related)<-[:MENTIONS]-(relChunk:Chunk)
		 WHERE NOT relChunk.pgId IN $seedChunkIds
		 RETURN DISTINCT relChunk.pgId AS pgId,
		        related.name AS entityName,
		        related.type AS entityType,
		        'RELATED_TO' AS relType
		 LIMIT 20`,
		{ seedChunkIds },
	);
}

interface EntityInfo {
	name: string;
	type: string;
	description: string;
	relatedNames: string[];
}

/** Get entities mentioned in specific chunks. */
export async function getEntitiesForChunks(chunkPgIds: string[]): Promise<EntityInfo[]> {
	return cypher<EntityInfo>(
		`UNWIND $chunkPgIds AS chunkId
		 MATCH (c:Chunk {pgId: chunkId})-[:MENTIONS]->(e:Entity)
		 OPTIONAL MATCH (e)-[:RELATED_TO]-(related:Entity)
		 RETURN DISTINCT e.name AS name,
		        e.type AS type,
		        e.description AS description,
		        collect(DISTINCT related.name) AS relatedNames`,
		{ chunkPgIds },
	);
}

/** Get all RAG entities and their relationships as KnowledgeData for visualization. */
export async function getAllRagEntities(): Promise<KnowledgeData> {
	const [nodeRows, relRows] = await Promise.all([
		cypher<{ n: Neo4jNodeRecord }>('MATCH (n:Entity) RETURN n'),
		cypher<{ r: Neo4jRelRecord; startId: string; endId: string }>(
			`MATCH (e1:Entity)-[r:RELATED_TO]->(e2:Entity)
			 RETURN r, elementId(e1) AS startId, elementId(e2) AS endId`,
		),
	]);
	return toKnowledgeData(
		nodeRows.map((row) => row.n),
		relRows.map((row) => ({ ...row.r, startNodeElementId: row.startId, endNodeElementId: row.endId })),
	);
}

/** Get a single entity node and its immediate neighbors as KnowledgeData. */
export async function getEntityNeighborhood(elementId: string): Promise<KnowledgeData> {
	const [nodeRows, relRows] = await Promise.all([
		cypher<{ n: Neo4jNodeRecord }>(
			`MATCH (center:Entity) WHERE elementId(center) = $id
			 OPTIONAL MATCH (center)-[:RELATED_TO]-(neighbor:Entity)
			 WITH center, collect(DISTINCT neighbor) AS neighbors
			 UNWIND (neighbors + [center]) AS n
			 WITH n WHERE n IS NOT NULL
			 RETURN DISTINCT n`,
			{ id: elementId },
		),
		cypher<{ r: Neo4jRelRecord; startId: string; endId: string }>(
			`MATCH (center:Entity) WHERE elementId(center) = $id
			 MATCH (center)-[r:RELATED_TO]-(neighbor:Entity)
			 RETURN r, elementId(startNode(r)) AS startId, elementId(endNode(r)) AS endId`,
			{ id: elementId },
		),
	]);
	return toKnowledgeData(
		nodeRows.map((row) => row.n),
		relRows.map((row) => ({ ...row.r, startNodeElementId: row.startId, endNodeElementId: row.endId })),
	);
}

/** Get the document graph structure for visualization. */
export async function getDocumentGraphData(documentId: string): Promise<{
	chunks: Array<{ pgId: string; level: string }>;
	entities: Array<{ name: string; type: string }>;
	mentions: Array<{ chunkPgId: string; entityName: string }>;
	relationships: Array<{ source: string; target: string; type: string }>;
}> {
	const [chunks, entities, mentions, relationships] = await Promise.all([
		cypher<{ pgId: string; level: string }>(
			`MATCH (c:Chunk {documentId: $documentId})
			 RETURN c.pgId AS pgId, c.level AS level`,
			{ documentId },
		),
		cypher<{ name: string; type: string }>(
			`MATCH (c:Chunk {documentId: $documentId})-[:MENTIONS]->(e:Entity)
			 RETURN DISTINCT e.name AS name, e.type AS type`,
			{ documentId },
		),
		cypher<{ chunkPgId: string; entityName: string }>(
			`MATCH (c:Chunk {documentId: $documentId})-[:MENTIONS]->(e:Entity)
			 RETURN c.pgId AS chunkPgId, e.name AS entityName`,
			{ documentId },
		),
		cypher<{ source: string; target: string; type: string }>(
			`MATCH (c:Chunk {documentId: $documentId})-[:MENTIONS]->(e1:Entity)
			 MATCH (e1)-[r:RELATED_TO]->(e2:Entity)
			 RETURN DISTINCT e1.name AS source, e2.name AS target, r.type AS type`,
			{ documentId },
		),
	]);

	return { chunks, entities, mentions, relationships };
}
