export { default as DeskShortcuts } from './DeskShortcuts.svelte';
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
export {
	type ContextChip,
	type ContextStatus,
	type PanelContext,
	type SerializedContext,
	dismissContext,
	getActiveContexts,
	getContextChips,
	getTokenEstimate,
	hasContext,
	markResponseReceived,
	pinContext,
	registerPanelContext,
	serializeForRequest,
	setContextFocus,
	togglePin,
	unpinContext,
	updatePanelContext,
} from './desk-context.svelte';
export { createDeskBus, deduped, type DeskBus, type DeskEvents, getDeskBus, setDeskBusContext } from './desk-bus.svelte';
export {
	type EntityOperation,
	type PanelEntity,
	type SerializedEntity,
	getAvailableToolNames,
	hasEntities,
	registerPanelEntity,
	resolveToolHandler,
	serializeEntitiesForRequest,
	updatePanelEntity,
} from './desk-entities.svelte';
export {
	type IOEntryKind,
	type IOLogEntry,
	type IOLogTurn,
	appendIOLog,
	clearIOLog,
	getIOLogEntries,
	getIOLogTurns,
	getUnreadCount,
	markAllRead,
} from './desk-io-log.svelte';
export {
	type UndoSnapshot,
	clearUndoForPanel,
	clearUndoStack,
	getUndoStackSize,
	peekUndo,
	pushUndo,
	undo,
	undoTurn,
} from './desk-undo.svelte';
export {
	type PermissionTier,
	getPermissionTier,
	setPermissionTier,
} from './desk-permissions.svelte';
export { LAYOUT_PRESETS, type LayoutPreset } from './layout-presets';
export { createDockState, type DockState, getDockContext, setDockContext } from './dock.state.svelte';
export {
	getActiveMenus,
	getFocusedPanelId,
	hasPanelMenus,
	type PanelMenus,
	registerPanelMenus,
	setFocusedPanel,
} from './panel-menus.svelte';
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
