/**
 * Workspace types — named, saveable dock layout configurations.
 * A workspace stores a complete DockLayoutState snapshot that can be
 * restored by switching. Max 9 per user.
 */
import type { DockLayoutState } from './dock.types';

/** A saved workspace with its full layout snapshot */
export interface Workspace {
	id: string;
	name: string;
	layout: DockLayoutState;
	sortOrder: number;
	createdAt: string; // ISO 8601
	updatedAt: string; // ISO 8601
}

/** Lightweight shape for list rendering (no layout blob) */
export interface WorkspaceListItem {
	id: string;
	name: string;
	sortOrder: number;
	panelCount: number;
}

/** Display mode for workspace switcher in the activity bar */
export type WorkspaceSwitcherMode = 'numbers' | 'select' | 'auto';

/** Max workspaces per user — matches Ctrl+Alt+1-9 shortcuts */
export const MAX_WORKSPACES = 9;

/** Workspaces visible as number buttons before overflow */
export const VISIBLE_WORKSPACE_BUTTONS = 5;
