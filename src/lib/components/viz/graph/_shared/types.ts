/** Base types shared by all graph visualization components */

export interface GraphNode {
	id: string;
	label?: string;
	x?: number;
	y?: number;
}

export interface GraphEdge {
	source: string;
	target: string;
}

export interface GraphData<N extends GraphNode = GraphNode, E extends GraphEdge = GraphEdge> {
	nodes: N[];
	edges: E[];
}
