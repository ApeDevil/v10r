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
} from '$lib/desk/layout.types';
export { disableScope, enableScope, getEnabledScopes, isScopeEnabled } from './bot-config.state.svelte';
export {
	type ConversationSummary,
	deleteConversations,
	deleteSingleConversation,
	fetchConversationStorage,
	getStorageState,
	type StorageMeta,
} from './conversation-storage.state.svelte';
export { default as DeskShortcuts } from './DeskShortcuts.svelte';
export { default as DockActivityBar } from './DockActivityBar.svelte';
export { default as DockDropOverlay } from './DockDropOverlay.svelte';
export { default as DockLayout } from './DockLayout.svelte';
export { default as DockLeaf } from './DockLeaf.svelte';
export { default as DockMobileBar } from './DockMobileBar.svelte';
export { default as DockMobileView } from './DockMobileView.svelte';
export { default as DockNode } from './DockNode.svelte';
export { default as DockResizeHandle } from './DockResizeHandle.svelte';
export { default as DockTabBar } from './DockTabBar.svelte';
export { createDeskBus, type DeskBus, type DeskEvents, getDeskBus, setDeskBusContext } from './desk-bus.svelte';
export {
	budgetAwareSerialize,
	computeActiveContexts,
	computeContextChips,
	computePanelStatus,
	estimateTokens,
	truncateToTokenBudget,
} from './desk-context.pure';
export {
	CONTEXT_TOKEN_BUDGET,
	type ContentLevel,
	type ContextChip,
	type ContextStatus,
	dismissContext,
	getContextChips,
	getContextRegistryVersion,
	getTokenEstimate,
	markResponseReceived,
	type PanelContext,
	type PanelStatus,
	pinContext,
	registerPanelContext,
	restoreContext,
	type SerializedContext,
	serializeForRequest,
	setContextFocus,
	updatePanelContext,
} from './desk-context.state.svelte';
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
} from './desk-settings.state.svelte';
export type { DeskPreset, DeskTheme, PanelColorOverride, WorkspaceColors } from './desk-settings.types';
export { dispatchDeskEffect, type EffectActions } from './dispatch-desk-effect';
export {
	addPanelToLeaf,
	collectLeaves,
	collectPanelIds,
	findLeafWithPanel,
	findNode,
	generateId,
	getDepth,
	hasPanelType,
	nextPanelOfType,
	removePanelFromLeaf,
	replaceNode,
	resolveDropZone,
	splitLeaf,
} from './dock.operations';
export { loadDockState, saveDockState } from './dock.persistence';
export { createDockState, type DockState, getDockContext, setDockContext } from './dock.state.svelte';
export { appendIOLog, clearIOLog, getIOLogEntries, type IOLogEntry, type IOLogSource } from './io-log.state.svelte';
export { default as PanelEmptyState } from './PanelEmptyState.svelte';
export {
	closeCurrent,
	focusPanel,
	openOrCycle,
	splitFocused,
	togglePanelType,
} from './panel-actions';
export {
	getPanelMenus,
	type PanelMenus,
	type PanelMenusState,
	setPanelMenusContext,
} from './panel-menus.state.svelte';
export {
	fetchProviders,
	getActiveProviderId,
	getProviderState,
	type ProviderInfo,
	switchProvider,
} from './provider-preference.state.svelte';
export { buildViewMenu, type ViewMenuActions } from './view-menu';
export { buildWorkspacesFromServer, loadWorkspaceStore, saveWorkspaceStore } from './workspace.persistence';
export {
	createWorkspaceState,
	getWorkspaceContext,
	setWorkspaceContext,
	type WorkspaceState,
} from './workspace.state.svelte';
export type { Workspace } from './workspace.types';
export { MAX_WORKSPACES, VISIBLE_WORKSPACE_BUTTONS } from './workspace.types';
