import type { KnowledgeData, KnowledgeEdge, KnowledgeNode } from '$lib/types/knowledge';

// ─── Relationship types ─────────────────────────────────

export const RELATIONSHIP_TYPES = [
	'DEPENDS_ON',
	'BELONGS_TO',
	'IMPLEMENTS',
	'INTEGRATES_WITH',
	'REPLACES',
	'DEMONSTRATES',
	'REQUIRES',
] as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

// ─── Neo4j HTTP response shapes ─────────────────────────

export interface Neo4jNodeRecord {
	elementId: string;
	labels: string[];
	properties: Record<string, unknown>;
}

export interface Neo4jRelRecord {
	elementId: string;
	startNodeElementId: string;
	endNodeElementId: string;
	type: string;
	properties: Record<string, unknown>;
}

// ─── KnowledgeData mapper ───────────────────────────────

/**
 * Transform raw Neo4j node/relationship records into KnowledgeData
 * for the KnowledgeGraph visualization component.
 */
export function toKnowledgeData(nodes: Neo4jNodeRecord[], relationships: Neo4jRelRecord[]): KnowledgeData {
	const entityTypes = [...new Set(nodes.map((n) => n.labels[0]))].sort();
	const relationshipTypes = [...new Set(relationships.map((r) => r.type))].sort();

	const knowledgeNodes: KnowledgeNode[] = nodes.map((n) => ({
		id: n.elementId,
		label: (n.properties.name as string) ?? n.elementId,
		entityType: n.labels[0],
		properties: n.properties,
	}));

	const knowledgeEdges: KnowledgeEdge[] = relationships.map((r) => ({
		source: r.startNodeElementId,
		target: r.endNodeElementId,
		relationshipType: r.type,
		label: r.type,
	}));

	return { nodes: knowledgeNodes, edges: knowledgeEdges, entityTypes, relationshipTypes };
}
