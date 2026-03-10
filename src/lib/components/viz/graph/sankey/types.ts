import type { GraphData, GraphEdge, GraphNode } from '../_shared/types';

export interface SankeyNodeData extends GraphNode {
	category?: string;
}

export interface SankeyLinkData extends GraphEdge {
	value: number;
}

export type SankeyData = GraphData<SankeyNodeData, SankeyLinkData>;
