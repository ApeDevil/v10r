import type { GraphData, GraphEdge, GraphNode } from '../_shared/types';

export interface NetworkNode extends GraphNode {
	group?: string;
	size?: number;
}

export interface NetworkEdge extends GraphEdge {
	weight?: number;
}

export type NetworkData = GraphData<NetworkNode, NetworkEdge>;
