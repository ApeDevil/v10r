import type { GraphNode, GraphEdge, GraphData } from '$lib/components/viz/graph/_shared/types';

export interface KnowledgeNode extends GraphNode {
	entityType: string;
	properties?: Record<string, unknown>;
}

export interface KnowledgeEdge extends GraphEdge {
	relationshipType: string;
	label?: string;
}

export interface KnowledgeData extends GraphData<KnowledgeNode, KnowledgeEdge> {
	entityTypes: string[];
	relationshipTypes: string[];
}
