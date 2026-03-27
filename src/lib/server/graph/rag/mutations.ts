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

/** Batch-create Chunk nodes. */
export async function batchCreateChunks(
	chunks: Array<{ pgId: string; documentId: string; level: string }>,
): Promise<void> {
	if (chunks.length === 0) return;
	await cypher(
		`UNWIND $chunks AS c
		 MERGE (ch:Chunk {pgId: c.pgId})
		 ON CREATE SET ch.documentId = c.documentId, ch.level = c.level`,
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

/** Batch-create entities, relationships, and mentions for a document. */
export async function storeDocumentGraph(
	entities: EntityInput[],
	relationships: RelationshipInput[],
	chunkEntityMap: Array<{ chunkPgId: string; entityName: string; confidence: number }>,
): Promise<{ entityCount: number; relationshipCount: number }> {
	if (entities.length > 0) {
		await cypher(
			`UNWIND $entities AS e
			 MERGE (n:Entity {name: e.name})
			 ON CREATE SET n.type = e.type, n.description = e.description
			 ON MATCH SET n.type = e.type, n.description = e.description`,
			{ entities },
		);
	}

	if (relationships.length > 0) {
		await cypher(
			`UNWIND $rels AS r
			 MATCH (a:Entity {name: r.sourceName})
			 MATCH (b:Entity {name: r.targetName})
			 MERGE (a)-[rel:RELATED_TO]->(b)
			 ON CREATE SET rel.type = r.type, rel.weight = r.weight
			 ON MATCH SET rel.weight = CASE WHEN rel.weight < r.weight THEN r.weight ELSE rel.weight END`,
			{ rels: relationships },
		);
	}

	if (chunkEntityMap.length > 0) {
		await cypher(
			`UNWIND $mentions AS m
			 MATCH (c:Chunk {pgId: m.chunkPgId})
			 MATCH (e:Entity {name: m.entityName})
			 MERGE (c)-[r:MENTIONS]->(e)
			 ON CREATE SET r.confidence = m.confidence`,
			{ mentions: chunkEntityMap },
		);
	}

	return {
		entityCount: entities.length,
		relationshipCount: relationships.length,
	};
}

/** Delete all graph data for a document and clean up orphaned entities. */
export async function deleteDocumentGraph(documentId: string): Promise<void> {
	await cypher(
		`MATCH (c:Chunk {documentId: $documentId})
		 DETACH DELETE c`,
		{ documentId },
	);

	// Remove entities no longer mentioned by any chunk
	await cypher(`MATCH (e:Entity) WHERE NOT (e)<-[:MENTIONS]-() DETACH DELETE e`);
}
