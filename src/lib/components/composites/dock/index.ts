export { default as DockActivityBar } from './DockActivityBar.svelte';
export { default as DockDropOverlay } from './DockDropOverlay.svelte';
export { default as DockLayout } from './DockLayout.svelte';
export { default as DockLeaf } from './DockLeaf.svelte';
export { default as DockNode } from './DockNode.svelte';
export { default as DockResizeHandle } from './DockResizeHandle.svelte';
export { default as DockTabBar } from './DockTabBar.svelte';
export {
	addPanelToLeaf,
	collectLeaves,
	findLeafWithPanel,
	findNode,
	findParent,
	generateId,
	getDepth,
	hasPanelType,
	removePanelFromLeaf,
	replaceNode,
	resolveDropZone,
	splitLeaf,
} from './dock.operations';
export { clearDockState, loadDockState, saveDockState } from './dock.persistence';
export { createDockState, type DockState, getDockContext, setDockContext } from './dock.state.svelte';
export type {
	ActivityBarItem,
	ActivityBarPosition,
	DockLayoutState,
	DragState,
	DropTarget,
	DropZone,
	LayoutNode,
	LeafNode,
	PanelDefinition,
	SplitNode,
} from './dock.types';
