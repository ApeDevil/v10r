/**
 * Pure functions for dock layout tree operations.
 * All mutations produce new trees (immutable replacement).
 */

import type { LayoutNode, SplitNode, LeafNode, DropZone, PanelDefinition } from './dock.types';

let counter = 0;

/** Generate a unique ID for layout nodes */
export function generateId(prefix: string): string {
	return `${prefix}-${Date.now()}-${counter++}`;
}

/** Find a node by ID in the tree */
export function findNode(root: LayoutNode, id: string): LayoutNode | null {
	if (root.id === id) return root;
	if (root.type === 'split') {
		return findNode(root.children[0], id) ?? findNode(root.children[1], id);
	}
	return null;
}

/** Find the parent split of a node by ID */
export function findParent(
	root: LayoutNode,
	targetId: string
): { parent: SplitNode; index: 0 | 1 } | null {
	if (root.type === 'leaf') return null;
	for (const i of [0, 1] as const) {
		if (root.children[i].id === targetId) {
			return { parent: root, index: i };
		}
		const found = findParent(root.children[i], targetId);
		if (found) return found;
	}
	return null;
}

/** Find the leaf containing a panel ID */
export function findLeafWithPanel(root: LayoutNode, panelId: string): LeafNode | null {
	if (root.type === 'leaf') {
		return root.tabs.includes(panelId) ? root : null;
	}
	return findLeafWithPanel(root.children[0], panelId) ?? findLeafWithPanel(root.children[1], panelId);
}

/**
 * Replace a node in the tree by ID.
 * Returns null if the replacement is null and the target is root (empty tree).
 */
export function replaceNode(
	root: LayoutNode,
	targetId: string,
	replacement: LayoutNode | null
): LayoutNode | null {
	if (root.id === targetId) return replacement;
	if (root.type === 'leaf') return root;

	const left = root.children[0].id === targetId
		? replacement
		: replaceNode(root.children[0], targetId, replacement);
	const right = root.children[1].id === targetId
		? replacement
		: replaceNode(root.children[1], targetId, replacement);

	// If one child was removed, promote the other
	if (left === null) return right;
	if (right === null) return left;

	return {
		...root,
		children: [left, right]
	};
}

/** Remove a panel from a leaf, returning updated leaf or null if empty */
export function removePanelFromLeaf(leaf: LeafNode, panelId: string): LeafNode | null {
	const tabs = leaf.tabs.filter((t) => t !== panelId);
	if (tabs.length === 0) return null;
	const activeTab = leaf.activeTab === panelId ? tabs[0] : leaf.activeTab;
	return { ...leaf, tabs, activeTab };
}

/** Add a panel as a tab in a leaf */
export function addPanelToLeaf(leaf: LeafNode, panelId: string): LeafNode {
	if (leaf.tabs.includes(panelId)) {
		return { ...leaf, activeTab: panelId };
	}
	return {
		...leaf,
		tabs: [...leaf.tabs, panelId],
		activeTab: panelId
	};
}

/** Create a new split by wrapping an existing leaf with a new leaf */
export function splitLeaf(
	existingLeaf: LeafNode,
	newPanelId: string,
	zone: Exclude<DropZone, 'center'>
): SplitNode {
	const newLeaf: LeafNode = {
		type: 'leaf',
		id: generateId('leaf'),
		tabs: [newPanelId],
		activeTab: newPanelId
	};

	const direction: 'horizontal' | 'vertical' =
		zone === 'left' || zone === 'right' ? 'horizontal' : 'vertical';

	const first = zone === 'left' || zone === 'top' ? newLeaf : existingLeaf;
	const second = zone === 'left' || zone === 'top' ? existingLeaf : newLeaf;

	return {
		type: 'split',
		id: generateId('split'),
		direction,
		children: [first, second],
		sizes: [50, 50]
	};
}

/** Get tree depth */
export function getDepth(node: LayoutNode): number {
	if (node.type === 'leaf') return 0;
	return 1 + Math.max(getDepth(node.children[0]), getDepth(node.children[1]));
}

/** Resolve which drop zone the pointer is in, given a bounding rect */
export function resolveDropZone(
	rect: { left: number; top: number; width: number; height: number },
	clientX: number,
	clientY: number
): DropZone {
	const relX = (clientX - rect.left) / rect.width;
	const relY = (clientY - rect.top) / rect.height;

	const edgeThreshold = 0.2;

	if (relY < edgeThreshold) return 'top';
	if (relY > 1 - edgeThreshold) return 'bottom';
	if (relX < edgeThreshold) return 'left';
	if (relX > 1 - edgeThreshold) return 'right';
	return 'center';
}

/** Collect all leaf nodes in the tree */
export function collectLeaves(node: LayoutNode): LeafNode[] {
	if (node.type === 'leaf') return [node];
	return [...collectLeaves(node.children[0]), ...collectLeaves(node.children[1])];
}

/** Check if a panel type exists anywhere in the tree */
export function hasPanelType(
	root: LayoutNode,
	panelType: string,
	panels: Record<string, PanelDefinition>
): boolean {
	const leaves = collectLeaves(root);
	return leaves.some((leaf) =>
		leaf.tabs.some((tabId) => panels[tabId]?.type === panelType)
	);
}
