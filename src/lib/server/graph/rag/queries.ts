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
	elementId: string;
	name: string;
	type: string;
	description: string;
	related: Array<{ elementId: string; name: string }>;
}

/** Get entities mentioned in specific chunks. */
export async function getEntitiesForChunks(chunkPgIds: string[]): Promise<EntityInfo[]> {
	return cypher<EntityInfo>(
		`UNWIND $chunkPgIds AS chunkId
		 MATCH (c:Chunk {pgId: chunkId})-[:MENTIONS]->(e:Entity)
		 OPTIONAL MATCH (e)-[:RELATED_TO]-(related:Entity)
		 WITH e, collect(DISTINCT related) AS relatedNodes
		 RETURN elementId(e) AS elementId,
		        e.name AS name,
		        e.type AS type,
		        e.description AS description,
		        [r IN relatedNodes WHERE r IS NOT NULL | {elementId: elementId(r), name: r.name}] AS related`,
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

/**
 * Find the shortest RELATED_TO path between two entities.
 * Returns the path as KnowledgeData (nodes + edges along the path)
 * so the explorer can merge any missing nodes and highlight the trail.
 * Returns null if no path exists within maxHops.
 */
export async function findShortestPath(
	fromId: string,
	toId: string,
	maxHops: number = 4,
): Promise<{ data: KnowledgeData; nodeIds: string[]; edgeKeys: string[] } | null> {
	const hops = Math.max(1, Math.min(maxHops, 6));

	// Pull the path's nodes/rels separately so we can use the same map shape
	// toKnowledgeData expects (startId/endId alongside the rel record).
	const [nodeRows, relRows] = await Promise.all([
		cypher<{ n: Neo4jNodeRecord }>(
			`MATCH (a:Entity) WHERE elementId(a) = $fromId
			 MATCH (b:Entity) WHERE elementId(b) = $toId
			 MATCH p = shortestPath((a)-[:RELATED_TO*..${hops}]-(b))
			 UNWIND nodes(p) AS n RETURN DISTINCT n`,
			{ fromId, toId },
		),
		cypher<{ r: Neo4jRelRecord; startId: string; endId: string }>(
			`MATCH (a:Entity) WHERE elementId(a) = $fromId
			 MATCH (b:Entity) WHERE elementId(b) = $toId
			 MATCH p = shortestPath((a)-[:RELATED_TO*..${hops}]-(b))
			 UNWIND relationships(p) AS r
			 RETURN r, elementId(startNode(r)) AS startId, elementId(endNode(r)) AS endId`,
			{ fromId, toId },
		),
	]);

	if (nodeRows.length === 0) return null;

	const data = toKnowledgeData(
		nodeRows.map((row) => row.n),
		relRows.map((row) => ({ ...row.r, startNodeElementId: row.startId, endNodeElementId: row.endId })),
	);
	const nodeIds = nodeRows.map((row) => row.n.elementId);
	const edgeKeys = relRows.map((row) => `${row.startId}→${row.endId}`);
	return { data, nodeIds, edgeKeys };
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
