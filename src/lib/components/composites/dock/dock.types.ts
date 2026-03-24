/**
 * Dock panel system types — VS Code-style docking layout.
 * Binary split tree with tabbed leaves.
 */

/** A content unit that can be displayed in a dock leaf */
export interface PanelDefinition {
	id: string;
	type: string;
	label: string;
	icon?: string;
	closable?: boolean;
	/** Tab status indicator (e.g. unsaved dot on editor tabs) */
	indicator?: 'unsaved' | 'saving' | 'error';
}

/** Binary split node — exactly 2 children */
export interface SplitNode {
	type: 'split';
	id: string;
	direction: 'horizontal' | 'vertical';
	children: [LayoutNode, LayoutNode];
	sizes: [number, number];
}

/** Leaf node — contains tabs (panel IDs) */
export interface LeafNode {
	type: 'leaf';
	id: string;
	tabs: string[];
	activeTab: string;
}

export type LayoutNode = SplitNode | LeafNode;

/** Drop zone position within a leaf */
export type DropZone = 'center' | 'left' | 'right' | 'top' | 'bottom';

/** Where a dragged panel will land */
export interface DropTarget {
	leafId: string;
	zone: DropZone;
}

/** Drag-in-progress state */
export interface DragState {
	panelId: string;
	sourceLeafId: string;
	target: DropTarget | null;
}

/** Activity bar position within the dock layout */
export type ActivityBarPosition = 'left' | 'right' | 'top' | 'bottom';

/** Activity bar entry */
export interface ActivityBarItem {
	panelType: string;
	icon: string;
	label: string;
}

/** Serializable layout for persistence */
export interface DockLayoutState {
	version: number;
	root: LayoutNode;
	panels: Record<string, PanelDefinition>;
	activityBarPosition?: ActivityBarPosition;
}
