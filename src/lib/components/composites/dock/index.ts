export { default as DockLayout } from './DockLayout.svelte';
export { default as DockNode } from './DockNode.svelte';
export { default as DockLeaf } from './DockLeaf.svelte';
export { default as DockTabBar } from './DockTabBar.svelte';
export { default as DockResizeHandle } from './DockResizeHandle.svelte';
export { default as DockDropOverlay } from './DockDropOverlay.svelte';
export { default as DockActivityBar } from './DockActivityBar.svelte';

export { createDockState, setDockContext, getDockContext, type DockState } from './dock.state.svelte';

export type {
	PanelDefinition,
	SplitNode,
	LeafNode,
	LayoutNode,
	DropZone,
	DropTarget,
	DragState,
	ActivityBarItem,
	ActivityBarPosition,
	DockLayoutState
} from './dock.types';

export {
	generateId,
	findNode,
	findParent,
	findLeafWithPanel,
	replaceNode,
	removePanelFromLeaf,
	addPanelToLeaf,
	splitLeaf,
	getDepth,
	resolveDropZone,
	collectLeaves,
	hasPanelType
} from './dock.operations';

export { saveDockState, loadDockState, clearDockState } from './dock.persistence';
