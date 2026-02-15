import type { GraphNode, GraphEdge, GraphData } from '../_shared/types';

export interface DagNode extends GraphNode {
	group?: string;
}

export interface DagEdge extends GraphEdge {}

export type DagData = GraphData<DagNode, DagEdge>;
