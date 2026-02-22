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

/** Create or update an Entity node. */
export async function upsertEntity(entity: EntityInput): Promise<void> {
	await cypher(
		`MERGE (e:Entity {name: $name})
		 ON CREATE SET e.type = $type, e.description = $description
		 ON MATCH SET e.type = $type, e.description = $description`,
		entity,
	);
}

/** Create a Chunk reference node linked to Postgres. */
export async function createChunkNode(
	pgId: string,
	documentId: string,
	level: string,
): Promise<void> {
	await cypher(
		`MERGE (c:Chunk {pgId: $pgId})
		 ON CREATE SET c.documentId = $documentId, c.level = $level`,
		{ pgId, documentId, level },
	);
}

/** Create a MENTIONS relationship between a Chunk and an Entity. */
export async function createMentions(
	chunkPgId: string,
	entityName: string,
	confidence: number,
): Promise<void> {
	await cypher(
		`MATCH (c:Chunk {pgId: $chunkPgId})
		 MATCH (e:Entity {name: $entityName})
		 MERGE (c)-[r:MENTIONS]->(e)
		 ON CREATE SET r.confidence = $confidence`,
		{ chunkPgId, entityName, confidence },
	);
}

/** Create a RELATED_TO relationship between two entities. */
export async function createRelatedTo(rel: RelationshipInput): Promise<void> {
	await cypher(
		`MATCH (a:Entity {name: $sourceName})
		 MATCH (b:Entity {name: $targetName})
		 MERGE (a)-[r:RELATED_TO]->(b)
		 ON CREATE SET r.type = $type, r.weight = $weight
		 ON MATCH SET r.weight = CASE WHEN r.weight < $weight THEN $weight ELSE r.weight END`,
		rel,
	);
}

/** Create HAS_CHILD relationship between parent and child chunks. */
export async function createHasChild(
	parentPgId: string,
	childPgId: string,
	position: number,
): Promise<void> {
	await cypher(
		`MATCH (p:Chunk {pgId: $parentPgId})
		 MATCH (c:Chunk {pgId: $childPgId})
		 MERGE (p)-[r:HAS_CHILD]->(c)
		 ON CREATE SET r.position = $position`,
		{ parentPgId, childPgId, position },
	);
}

/** Create NEXT_CHUNK relationship for sequential ordering. */
export async function createNextChunk(
	fromPgId: string,
	toPgId: string,
): Promise<void> {
	await cypher(
		`MATCH (a:Chunk {pgId: $fromPgId})
		 MATCH (b:Chunk {pgId: $toPgId})
		 MERGE (a)-[:NEXT_CHUNK]->(b)`,
		{ fromPgId, toPgId },
	);
}

/** Bulk create entities and relationships for a document. */
export async function storeDocumentGraph(
	entities: EntityInput[],
	relationships: RelationshipInput[],
	chunkEntityMap: Array<{ chunkPgId: string; entityName: string; confidence: number }>,
): Promise<{ entityCount: number; relationshipCount: number }> {
	for (const entity of entities) {
		await upsertEntity(entity);
	}

	for (const rel of relationships) {
		await createRelatedTo(rel);
	}

	for (const mention of chunkEntityMap) {
		await createMentions(mention.chunkPgId, mention.entityName, mention.confidence);
	}

	return {
		entityCount: entities.length,
		relationshipCount: relationships.length,
	};
}

/** Delete all graph data for a document. */
export async function deleteDocumentGraph(documentId: string): Promise<void> {
	await cypher(
		`MATCH (c:Chunk {documentId: $documentId})
		 DETACH DELETE c`,
		{ documentId },
	);
}
