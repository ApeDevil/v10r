import { cypher } from '../index';

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
