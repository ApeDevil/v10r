export {
	cancelDelete,
	confirmDelete,
	disableScope,
	enableScope,
	getEnabledScopes,
	hasWriteAccess,
	isDeletePending,
	isScopeEnabled,
	toggleScope,
} from './bot-config.svelte';
export { default as DeskShortcuts } from './DeskShortcuts.svelte';
export { default as DockActivityBar } from './DockActivityBar.svelte';
export { default as DockDropOverlay } from './DockDropOverlay.svelte';
export { default as DockLayout } from './DockLayout.svelte';
export { default as DockLeaf } from './DockLeaf.svelte';
export { default as DockNode } from './DockNode.svelte';
export { default as DockResizeHandle } from './DockResizeHandle.svelte';
export { default as DockTabBar } from './DockTabBar.svelte';
export { default as PanelEmptyState } from './PanelEmptyState.svelte';
export { createDeskBus, type DeskBus, type DeskEvents, getDeskBus, setDeskBusContext } from './desk-bus.svelte';
export {
	type ContentLevel,
	CONTEXT_TOKEN_BUDGET,
	type ContextChip,
	type ContextStatus,
	dismissContext,
	getActiveContexts,
	getContextChips,
	getTokenEstimate,
	hasContext,
	markResponseReceived,
	type PanelContext,
	type PanelStatus,
	pinContext,
	registerPanelContext,
	restoreContext,
	type SerializedContext,
	serializeForRequest,
	setContextFocus,
	togglePin,
	unpinContext,
	updatePanelContext,
} from './desk-context.svelte';
export {
	budgetAwareSerialize,
	computeActiveContexts,
	computeContextChips,
	computePanelStatus,
	estimateTokens,
	truncateToTokenBudget,
} from './desk-context.pure';
export { dispatchDeskEffect, type EffectActions } from './dispatch-desk-effect';
export {
	BUILT_IN_PRESETS,
	buildThemeFromServer,
	clearDeskSettings,
	DEFAULT_THEME,
	loadDeskSettings,
	saveDeskSettings,
} from './desk-settings.persistence';
export {
	createDeskSettings,
	type DeskSettings,
	type DeskSettingsOptions,
	getDeskSettings,
	setDeskSettingsContext,
} from './desk-settings.svelte';
export type { DeskPreset, DeskTheme, PanelColorOverride, WorkspaceColors } from './desk-settings.types';
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
export {
	type ConversationSummary,
	deleteConversations,
	deleteSingleConversation,
	fetchConversationStorage,
	getStorageState,
	resetStorageState,
	type StorageMeta,
} from './conversation-storage.svelte';
export {
	fetchProviders,
	getActiveProviderId,
	getProviderState,
	type ProviderInfo,
	switchProvider,
} from './provider-preference.svelte';
export {
	appendIOLog,
	clearIOLog,
	getIOLogCount,
	getIOLogEntries,
	type IOLogEntry,
	type IOLogSource,
} from './io-log.svelte';
export { LAYOUT_PRESETS, type LayoutPreset } from './layout-presets';
export {
	getActiveMenus,
	getFocusedPanelId,
	hasPanelMenus,
	type PanelMenus,
	registerPanelMenus,
	setFocusedPanel,
} from './panel-menus.svelte';
export {
	buildWorkspacesFromServer,
	clearWorkspaceStore,
	loadWorkspaceStore,
	saveWorkspaceStore,
} from './workspace.persistence';
export {
	createWorkspaceState,
	getWorkspaceContext,
	setWorkspaceContext,
	type WorkspaceState,
} from './workspace.state.svelte';
export type { Workspace, WorkspaceListItem, WorkspaceSwitcherMode } from './workspace.types';
export { MAX_WORKSPACES, VISIBLE_WORKSPACE_BUTTONS } from './workspace.types';
