/**
 * Dock layout persistence via localStorage.
 * Validates structure on load, prunes invalid panel references.
 */

import { browser } from '$app/environment';
import type { LayoutNode, PanelDefinition, DockLayoutState, LeafNode, ActivityBarPosition } from './dock.types';

const DEFAULT_KEY = 'dock-layout';
const CURRENT_VERSION = 1;

/** Save dock state to localStorage */
export function saveDockState(
	root: LayoutNode,
	panels: Record<string, PanelDefinition>,
	storageKey = DEFAULT_KEY,
	activityBarPosition?: ActivityBarPosition
): void {
	if (!browser) return;
	try {
		const state: DockLayoutState = { version: CURRENT_VERSION, root, panels, activityBarPosition };
		localStorage.setItem(storageKey, JSON.stringify(state));
	} catch {
		// Silently fail (e.g., storage full)
	}
}

/** Load dock state from localStorage, returns null if invalid */
export function loadDockState(storageKey = DEFAULT_KEY): DockLayoutState | null {
	if (!browser) return null;
	try {
		const raw = localStorage.getItem(storageKey);
		if (!raw) return null;

		const state = JSON.parse(raw) as DockLayoutState;
		if (!state || state.version !== CURRENT_VERSION) return null;
		if (!isValidNode(state.root)) return null;

		// Prune tabs referencing unknown panels
		pruneInvalidTabs(state.root, state.panels);

		return state;
	} catch {
		return null;
	}
}

/** Clear persisted state */
export function clearDockState(storageKey = DEFAULT_KEY): void {
	if (!browser) return;
	localStorage.removeItem(storageKey);
}

/** Validate layout node structure */
function isValidNode(node: unknown): node is LayoutNode {
	if (!node || typeof node !== 'object') return false;
	const n = node as Record<string, unknown>;

	if (n.type === 'leaf') {
		return typeof n.id === 'string' && Array.isArray(n.tabs) && typeof n.activeTab === 'string';
	}

	if (n.type === 'split') {
		return (
			typeof n.id === 'string' &&
			(n.direction === 'horizontal' || n.direction === 'vertical') &&
			Array.isArray(n.children) &&
			n.children.length === 2 &&
			Array.isArray(n.sizes) &&
			n.sizes.length === 2 &&
			isValidNode(n.children[0]) &&
			isValidNode(n.children[1])
		);
	}

	return false;
}

/** Remove tabs that reference panels not in the registry */
function pruneInvalidTabs(node: LayoutNode, panels: Record<string, PanelDefinition>): void {
	if (node.type === 'leaf') {
		const leaf = node as LeafNode;
		leaf.tabs = leaf.tabs.filter((id) => id in panels);
		if (leaf.tabs.length > 0 && !leaf.tabs.includes(leaf.activeTab)) {
			leaf.activeTab = leaf.tabs[0];
		}
		return;
	}
	pruneInvalidTabs(node.children[0], panels);
	pruneInvalidTabs(node.children[1], panels);
}
