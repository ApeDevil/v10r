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
export { createDeskBus, type DeskBus, type DeskEvents, getDeskBus, setDeskBusContext } from './desk-bus.svelte';
export { appendIOLog, clearIOLog, getIOLogEntries, getIOLogCount, type IOLogEntry, type IOLogSource } from './io-log.svelte';
export { createDeskSettings, type DeskSettings, type DeskSettingsOptions, getDeskSettings, setDeskSettingsContext } from './desk-settings.svelte';
export { buildThemeFromServer, clearDeskSettings, DEFAULT_THEME, loadDeskSettings, saveDeskSettings, BUILT_IN_PRESETS } from './desk-settings.persistence';
export type { DeskPreset, DeskTheme, PanelColorOverride, WorkspaceColors } from './desk-settings.types';
export { LAYOUT_PRESETS, type LayoutPreset } from './layout-presets';
export { createWorkspaceState, type WorkspaceState, getWorkspaceContext, setWorkspaceContext } from './workspace.state.svelte';
export { buildWorkspacesFromServer, clearWorkspaceStore, loadWorkspaceStore, saveWorkspaceStore } from './workspace.persistence';
export type { Workspace, WorkspaceListItem, WorkspaceSwitcherMode } from './workspace.types';
export { MAX_WORKSPACES, VISIBLE_WORKSPACE_BUTTONS } from './workspace.types';
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
