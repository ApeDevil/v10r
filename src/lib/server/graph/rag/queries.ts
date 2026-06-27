import type { KnowledgeData } from '$lib/types/knowledge';
import { cypher } from '../index';
import type { Neo4jNodeRecord, Neo4jRelRecord } from '../types';
import { toKnowledgeData } from '../types';

/**
 * RAG graph reads are tenant-scoped. Every function takes `ownerIds` — typically
 * `[user.id, SYSTEM_DOCS_USER_ID]` so a user sees their own corpus plus the shared
 * system docs. Entities and chunks carry `ownerId` (per-tenant), so an attacker
 * passing another tenant's elementId/pgId gets an empty result, not a leak.
 */

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

export async function expandViaGraph(
	seedChunkIds: string[],
	ownerIds: string[],
	maxHops: number = 2,
	/** Per-query Neo4j timeout. Omit to inherit the 30s ingest/admin default; user-facing
	 *  retrieval passes USER_GRAPH_TIMEOUT_MS so a slow Aura instance can't block a response. */
	timeoutMs?: number,
): Promise<GraphChunkResult[]> {
	const hops = Math.min(maxHops, 2); // Hard cap at 2
	const hopPattern = HOP_PATTERNS[hops];
	if (!hopPattern) throw new Error(`Invalid hops value: ${hops}. Must be 1 or 2.`);

	return cypher<GraphChunkResult>(
		`UNWIND $seedChunkIds AS seedId
		 MATCH (seed:Chunk {pgId: seedId})-[:MENTIONS]->(e:Entity)
		 WHERE e.ownerId IN $ownerIds
		 MATCH (e)-[:RELATED_TO${hopPattern}]->(related:Entity)
		 WHERE related.ownerId IN $ownerIds
		 MATCH (related)<-[:MENTIONS]-(relChunk:Chunk)
		 WHERE relChunk.ownerId IN $ownerIds AND NOT relChunk.pgId IN $seedChunkIds
		 RETURN DISTINCT relChunk.pgId AS pgId,
		        related.name AS entityName,
		        related.type AS entityType,
		        'RELATED_TO' AS relType
		 LIMIT 20`,
		{ seedChunkIds, ownerIds },
		timeoutMs !== undefined ? { timeoutMs } : undefined,
	);
}

interface EntityInfo {
	elementId: string;
	name: string;
	type: string;
	description: string;
	related: Array<{ elementId: string; name: string }>;
}

/** Get entities mentioned in specific chunks (tenant-scoped). */
export async function getEntitiesForChunks(
	chunkPgIds: string[],
	ownerIds: string[],
	/** Per-query Neo4j timeout. Omit to inherit the 30s default; user-facing retrieval
	 *  passes USER_GRAPH_TIMEOUT_MS to keep the response path from blocking on Aura. */
	timeoutMs?: number,
): Promise<EntityInfo[]> {
	return cypher<EntityInfo>(
		`UNWIND $chunkPgIds AS chunkId
		 MATCH (c:Chunk {pgId: chunkId})-[:MENTIONS]->(e:Entity)
		 WHERE e.ownerId IN $ownerIds
		 OPTIONAL MATCH (e)-[:RELATED_TO]-(related:Entity)
		 WHERE related.ownerId IN $ownerIds
		 WITH e, collect(DISTINCT related) AS relatedNodes
		 RETURN elementId(e) AS elementId,
		        e.name AS name,
		        e.type AS type,
		        e.description AS description,
		        [r IN relatedNodes WHERE r IS NOT NULL | {elementId: elementId(r), name: r.name}] AS related`,
		{ chunkPgIds, ownerIds },
		timeoutMs !== undefined ? { timeoutMs } : undefined,
	);
}

/** Lightweight graph corpus stats for the retrieval overview (tenant-scoped). */
export async function getRagGraphStats(ownerIds: string[]): Promise<{
	nodes: number;
	edges: number;
	labels: string[];
}> {
	const [nodeCount, edgeCount] = await Promise.all([
		cypher<{ c: number }>('MATCH (n:Entity) WHERE n.ownerId IN $ownerIds RETURN count(n) AS c', { ownerIds }),
		cypher<{ c: number }>(
			`MATCH (e1:Entity)-[r:RELATED_TO]->(e2:Entity)
			 WHERE e1.ownerId IN $ownerIds AND e2.ownerId IN $ownerIds
			 RETURN count(r) AS c`,
			{ ownerIds },
		),
	]);
	return {
		nodes: Number(nodeCount[0]?.c ?? 0),
		edges: Number(edgeCount[0]?.c ?? 0),
		labels: ['Entity'],
	};
}

/** Get all RAG entities and their relationships as KnowledgeData for visualization (tenant-scoped). */
export async function getAllRagEntities(ownerIds: string[]): Promise<KnowledgeData> {
	const [nodeRows, relRows] = await Promise.all([
		cypher<{ n: Neo4jNodeRecord }>('MATCH (n:Entity) WHERE n.ownerId IN $ownerIds RETURN n', { ownerIds }),
		cypher<{ r: Neo4jRelRecord; startId: string; endId: string }>(
			`MATCH (e1:Entity)-[r:RELATED_TO]->(e2:Entity)
			 WHERE e1.ownerId IN $ownerIds AND e2.ownerId IN $ownerIds
			 RETURN r, elementId(e1) AS startId, elementId(e2) AS endId`,
			{ ownerIds },
		),
	]);
	return toKnowledgeData(
		nodeRows.map((row) => row.n),
		relRows.map((row) => ({ ...row.r, startNodeElementId: row.startId, endNodeElementId: row.endId })),
	);
}

/** Get a single entity node and its immediate neighbors as KnowledgeData (tenant-scoped). */
export async function getEntityNeighborhood(elementId: string, ownerIds: string[]): Promise<KnowledgeData> {
	const [nodeRows, relRows] = await Promise.all([
		cypher<{ n: Neo4jNodeRecord }>(
			`MATCH (center:Entity) WHERE elementId(center) = $id AND center.ownerId IN $ownerIds
			 OPTIONAL MATCH (center)-[:RELATED_TO]-(neighbor:Entity)
			 WHERE neighbor.ownerId IN $ownerIds
			 WITH center, collect(DISTINCT neighbor) AS neighbors
			 UNWIND (neighbors + [center]) AS n
			 WITH n WHERE n IS NOT NULL
			 RETURN DISTINCT n`,
			{ id: elementId, ownerIds },
		),
		cypher<{ r: Neo4jRelRecord; startId: string; endId: string }>(
			`MATCH (center:Entity) WHERE elementId(center) = $id AND center.ownerId IN $ownerIds
			 MATCH (center)-[r:RELATED_TO]-(neighbor:Entity)
			 WHERE neighbor.ownerId IN $ownerIds
			 RETURN r, elementId(startNode(r)) AS startId, elementId(endNode(r)) AS endId`,
			{ id: elementId, ownerIds },
		),
	]);
	return toKnowledgeData(
		nodeRows.map((row) => row.n),
		relRows.map((row) => ({ ...row.r, startNodeElementId: row.startId, endNodeElementId: row.endId })),
	);
}

/**
 * Find the shortest RELATED_TO path between two entities (tenant-scoped).
 * Both endpoints and every node on the path must be owned by the caller.
 * Returns null if no path exists within maxHops.
 */
export async function findShortestPath(
	fromId: string,
	toId: string,
	ownerIds: string[],
	maxHops: number = 4,
): Promise<{ data: KnowledgeData; nodeIds: string[]; edgeKeys: string[] } | null> {
	const hops = Math.max(1, Math.min(maxHops, 6));

	// Pull the path's nodes/rels separately so we can use the same map shape
	// toKnowledgeData expects (startId/endId alongside the rel record). The path
	// pattern requires every intermediate node to be owned by the caller.
	const [nodeRows, relRows] = await Promise.all([
		cypher<{ n: Neo4jNodeRecord }>(
			`MATCH (a:Entity) WHERE elementId(a) = $fromId AND a.ownerId IN $ownerIds
			 MATCH (b:Entity) WHERE elementId(b) = $toId AND b.ownerId IN $ownerIds
			 MATCH p = shortestPath((a)-[:RELATED_TO*..${hops}]-(b))
			 WHERE all(node IN nodes(p) WHERE node.ownerId IN $ownerIds)
			 UNWIND nodes(p) AS n RETURN DISTINCT n`,
			{ fromId, toId, ownerIds },
		),
		cypher<{ r: Neo4jRelRecord; startId: string; endId: string }>(
			`MATCH (a:Entity) WHERE elementId(a) = $fromId AND a.ownerId IN $ownerIds
			 MATCH (b:Entity) WHERE elementId(b) = $toId AND b.ownerId IN $ownerIds
			 MATCH p = shortestPath((a)-[:RELATED_TO*..${hops}]-(b))
			 WHERE all(node IN nodes(p) WHERE node.ownerId IN $ownerIds)
			 UNWIND relationships(p) AS r
			 RETURN r, elementId(startNode(r)) AS startId, elementId(endNode(r)) AS endId`,
			{ fromId, toId, ownerIds },
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
