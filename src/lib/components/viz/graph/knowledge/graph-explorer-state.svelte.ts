import type { KnowledgeData, KnowledgeEdge, KnowledgeNode } from '$lib/types/knowledge';

/**
 * Svelte 5 runes class that manages accumulated graph state for the explorer.
 * Supports merging new nodes/edges from search results or node expansion.
 */
export class GraphExplorerState {
	nodes = $state<KnowledgeNode[]>([]);
	edges = $state<KnowledgeEdge[]>([]);
	expandedNodeIds = $state<Set<string>>(new Set());
	selectedNodeId = $state<string | null>(null);
	loading = $state(false);

	get data(): KnowledgeData {
		const entityTypes = [...new Set(this.nodes.map((n) => n.entityType))].sort();
		const relationshipTypes = [...new Set(this.edges.map((e) => e.relationshipType))].sort();
		return { nodes: this.nodes, edges: this.edges, entityTypes, relationshipTypes };
	}

	get selectedNode(): KnowledgeNode | undefined {
		if (!this.selectedNodeId) return undefined;
		return this.nodes.find((n) => n.id === this.selectedNodeId);
	}

	get selectedNodeEdges(): KnowledgeEdge[] {
		if (!this.selectedNodeId) return [];
		return this.edges.filter((e) => e.source === this.selectedNodeId || e.target === this.selectedNodeId);
	}

	merge(incoming: KnowledgeData) {
		const existingIds = new Set(this.nodes.map((n) => n.id));
		const newNodes = incoming.nodes.filter((n) => !existingIds.has(n.id));
		if (newNodes.length > 0) {
			this.nodes = [...this.nodes, ...newNodes];
		}

		const edgeKey = (e: KnowledgeEdge) => `${e.source}→${e.target}→${e.relationshipType}`;
		const existingEdgeKeys = new Set(this.edges.map(edgeKey));
		const newEdges = incoming.edges.filter((e) => !existingEdgeKeys.has(edgeKey(e)));
		if (newEdges.length > 0) {
			this.edges = [...this.edges, ...newEdges];
		}
	}

	replace(data: KnowledgeData) {
		this.nodes = [...data.nodes];
		this.edges = [...data.edges];
		this.expandedNodeIds = new Set();
		this.selectedNodeId = null;
	}

	clear() {
		this.nodes = [];
		this.edges = [];
		this.expandedNodeIds = new Set();
		this.selectedNodeId = null;
	}

	markExpanded(nodeId: string) {
		this.expandedNodeIds = new Set([...this.expandedNodeIds, nodeId]);
	}

	isExpanded(nodeId: string): boolean {
		return this.expandedNodeIds.has(nodeId);
	}
}
