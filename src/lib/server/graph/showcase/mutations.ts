import { Neo4jError } from '../errors';
import { cypher } from '../index';
import { RELATIONSHIP_TYPES, type RelationshipType } from '../types';

// ─── Relationship type allowlist ────────────────────────
// Cypher can't parameterize relationship types, so we validate against an allowlist.

function assertAllowedRelType(type: string): asserts type is RelationshipType {
	if (!RELATIONSHIP_TYPES.includes(type as RelationshipType)) {
		throw new Neo4jError('syntax', `Relationship type "${type}" is not allowed`);
	}
}

// ─── Technology mutations ───────────────────────────────

interface CreateTechnologyInput {
	name: string;
	description: string;
	category: string;
	version?: string;
	url?: string;
	layerName?: string;
}

export async function createTechnology(input: CreateTechnologyInput): Promise<void> {
	const { name, description, category, version, url, layerName } = input;

	const props: Record<string, unknown> = { name, description, category };
	if (version) props.version = version;
	if (url) props.url = url;

	if (layerName) {
		await cypher(
			`CREATE (t:Technology $props)
			 WITH t
			 MATCH (l:Layer {name: $layerName})
			 CREATE (t)-[:BELONGS_TO]->(l)`,
			{ props, layerName },
		);
	} else {
		await cypher('CREATE (t:Technology $props)', { props });
	}
}

export async function deleteTechnology(elementId: string): Promise<void> {
	await cypher('MATCH (n) WHERE elementId(n) = $id DETACH DELETE n', { id: elementId });
}

// ─── Relationship mutations ─────────────────────────────

export async function createRelationship(fromId: string, toId: string, type: string): Promise<void> {
	assertAllowedRelType(type);

	// Safe: type has been validated against the allowlist
	await cypher(
		`MATCH (a), (b)
		 WHERE elementId(a) = $fromId AND elementId(b) = $toId
		 MERGE (a)-[:${type}]->(b)`,
		{ fromId, toId },
	);
}

export async function deleteRelationship(fromId: string, toId: string, type: string): Promise<void> {
	assertAllowedRelType(type);

	await cypher(
		`MATCH (a)-[r:${type}]->(b)
		 WHERE elementId(a) = $fromId AND elementId(b) = $toId
		 DELETE r`,
		{ fromId, toId },
	);
}
