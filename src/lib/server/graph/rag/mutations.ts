import { cypher } from '../index';

interface EntityInput {
	name: string;
	type: string;
	description: string;
}

interface RelationshipInput {
	sourceName: string;
	targetName: string;
	type: string;
	weight: number;
}

/**
 * Batch-create Chunk nodes.
 *
 * Every chunk carries `ownerId` (the owning user, or SYSTEM_DOCS_USER_ID for the
 * system corpus) so all reads can scope by tenant. `ON MATCH` re-stamps ownerId
 * so a re-ingest backfills nodes created before tenancy existed.
 */
export async function batchCreateChunks(
	chunks: Array<{ pgId: string; documentId: string; level: string; ownerId: string }>,
): Promise<void> {
	if (chunks.length === 0) return;
	await cypher(
		`UNWIND $chunks AS c
		 MERGE (ch:Chunk {pgId: c.pgId})
		 ON CREATE SET ch.documentId = c.documentId, ch.level = c.level, ch.ownerId = c.ownerId
		 ON MATCH SET ch.ownerId = c.ownerId`,
		{ chunks },
	);
}

/** Batch-create HAS_CHILD edges between parent and child chunks. */
export async function batchCreateHasChild(
	edges: Array<{ parentPgId: string; childPgId: string; position: number }>,
): Promise<void> {
	if (edges.length === 0) return;
	await cypher(
		`UNWIND $edges AS e
		 MATCH (p:Chunk {pgId: e.parentPgId})
		 MATCH (c:Chunk {pgId: e.childPgId})
		 MERGE (p)-[r:HAS_CHILD]->(c)
		 ON CREATE SET r.position = e.position`,
		{ edges },
	);
}

/** Batch-create NEXT_CHUNK edges for sequential ordering. */
export async function batchCreateNextChunk(edges: Array<{ fromPgId: string; toPgId: string }>): Promise<void> {
	if (edges.length === 0) return;
	await cypher(
		`UNWIND $edges AS e
		 MATCH (a:Chunk {pgId: e.fromPgId})
		 MATCH (b:Chunk {pgId: e.toPgId})
		 MERGE (a)-[:NEXT_CHUNK]->(b)`,
		{ edges },
	);
}

/**
 * Batch-create entities, relationships, and mentions for a document.
 *
 * Entities are per-tenant: the MERGE key is `{name, ownerId}` so one user's
 * ingest can never read or overwrite another user's entity description (the
 * cross-tenant integrity bug that name-only MERGE allowed).
 */
export async function storeDocumentGraph(
	entities: EntityInput[],
	relationships: RelationshipInput[],
	chunkEntityMap: Array<{ chunkPgId: string; entityName: string; confidence: number }>,
	ownerId: string,
): Promise<{ entityCount: number; relationshipCount: number }> {
	if (entities.length > 0) {
		await cypher(
			`UNWIND $entities AS e
			 MERGE (n:Entity {name: e.name, ownerId: $ownerId})
			 ON CREATE SET n.type = e.type, n.description = e.description
			 ON MATCH SET n.type = e.type, n.description = e.description`,
			{ entities, ownerId },
		);
	}

	if (relationships.length > 0) {
		await cypher(
			`UNWIND $rels AS r
			 MATCH (a:Entity {name: r.sourceName, ownerId: $ownerId})
			 MATCH (b:Entity {name: r.targetName, ownerId: $ownerId})
			 MERGE (a)-[rel:RELATED_TO]->(b)
			 ON CREATE SET rel.type = r.type, rel.weight = r.weight
			 ON MATCH SET rel.weight = CASE WHEN rel.weight < r.weight THEN r.weight ELSE rel.weight END`,
			{ rels: relationships, ownerId },
		);
	}

	if (chunkEntityMap.length > 0) {
		await cypher(
			`UNWIND $mentions AS m
			 MATCH (c:Chunk {pgId: m.chunkPgId})
			 MATCH (e:Entity {name: m.entityName, ownerId: $ownerId})
			 MERGE (c)-[r:MENTIONS]->(e)
			 ON CREATE SET r.confidence = m.confidence`,
			{ mentions: chunkEntityMap, ownerId },
		);
	}

	return {
		entityCount: entities.length,
		relationshipCount: relationships.length,
	};
}

/** Delete all graph data for a document (owner-scoped) and clean up this owner's orphaned entities. */
export async function deleteDocumentGraph(documentId: string, ownerId: string): Promise<void> {
	await cypher(
		`MATCH (c:Chunk {documentId: $documentId, ownerId: $ownerId})
		 DETACH DELETE c`,
		{ documentId, ownerId },
	);

	// Remove this owner's entities no longer mentioned by any chunk
	await cypher(`MATCH (e:Entity {ownerId: $ownerId}) WHERE NOT (e)<-[:MENTIONS]-() DETACH DELETE e`, { ownerId });
}

/**
 * Purge ALL of a user's RAG graph (chunks + entities) — the Neo4j half of GDPR
 * erasure. Postgres CASCADE deletes the relational rows; this removes their graph
 * mirror so deleted-user content can't resurface via topology. Entities are
 * per-tenant, so deleting the owner's entities outright is safe (no shared nodes).
 */
export async function deleteUserGraph(ownerId: string): Promise<void> {
	await cypher(`MATCH (c:Chunk {ownerId: $ownerId}) DETACH DELETE c`, { ownerId });
	await cypher(`MATCH (e:Entity {ownerId: $ownerId}) DETACH DELETE e`, { ownerId });
}
