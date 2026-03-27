/** Tree uses recursive children, not flat nodes/edges (d3-hierarchy expects this) */
export interface TreeNode {
	id: string;
	label?: string;
	children?: TreeNode[];
}

export type TreeData = TreeNode;
