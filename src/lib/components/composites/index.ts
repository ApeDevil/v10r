// Composite component exports
export * from './page-header';
export * from './back-link';

export { default as Card } from './card/Card.svelte';

export { default as FormField } from './form-field/FormField.svelte';

export { default as ConfirmDialog } from './confirm-dialog/ConfirmDialog.svelte';

export { default as Toaster } from './toast/Toaster.svelte';

export { default as QuickSearch } from './quick-search/QuickSearch.svelte';
export { default as QuickSearchTrigger } from './quick-search/QuickSearchTrigger.svelte';

export { Chatbot } from './chatbot';

export { default as Alert } from './alert/Alert.svelte';

export { Pagination } from './pagination';

export * from './empty-state';
export * from './error-display';
export * from './boundary-fallback';
export * from './link-card';
export * from './menu-bar';
export * from './context-menu';
export * from './dropdown-menu';
export * from './nav-section';
export * from './nav-tab';
export * from './nav-grid';

export { DatePicker } from './date-picker';
export {
	datePickerRootVariants,
	datePickerTriggerVariants,
	datePickerContentVariants,
	datePickerCalendarVariants,
	datePickerLabelVariants,
	type DatePickerRootVariants,
	type DatePickerTriggerVariants,
	type DatePickerContentVariants,
	type DatePickerCalendarVariants,
	type DatePickerLabelVariants
} from './date-picker';

export { ReorderablePaneLayout, PaneTabBar } from './reorderable-panes';
export {
	tabBarVariants,
	tabVariants,
	gripVariants,
	type PaneDefinition,
	type TabBarVariants,
	type TabVariants,
	type GripVariants
} from './reorderable-panes';

export {
	DockLayout,
	DockNode,
	DockLeaf,
	DockTabBar,
	DockDropOverlay,
	DockActivityBar
} from './dock';
export {
	createDockState,
	setDockContext,
	getDockContext,
	type DockState
} from './dock';
export type {
	PanelDefinition as DockPanelDefinition,
	SplitNode,
	LeafNode,
	LayoutNode,
	DropZone,
	DropTarget,
	DragState,
	ActivityBarItem,
	DockLayoutState
} from './dock';
