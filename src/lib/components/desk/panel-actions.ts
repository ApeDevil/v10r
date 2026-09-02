/**
 * Idempotent actions over a live DockState — the shared verbs every surface
 * (desktop leaf, mobile chrome, URL params, AI effects) calls instead of
 * re-implementing focus/open semantics.
 *
 * Deliberately separate from dock.operations.ts, which stays pure tree math
 * over (root, panels); these functions mutate a DockState instance.
 */

import type { ActivityBarItem } from '$lib/desk/layout.types';
import { collectLeaves, findLeafWithPanel, hasPanelType, nextPanelOfType } from './dock.operations';
import type { DockState } from './dock.state.svelte';

/**
 * Make `panelId` THE focused panel: activate it on its real leaf and focus
 * that leaf. Returns false when the panel is not in the tree. Idempotent —
 * safe to call from effects (re-applying the current focus is a no-op apart
 * from the focusSeq bump, which is the observable "surface this" signal).
 */
export function focusPanel(dock: DockState, panelId: string): boolean {
	const leaf = findLeafWithPanel(dock.root, panelId);
	if (!leaf) return false;
	dock.activateTab(leaf.id, panelId);
	dock.setFocusedLeaf(leaf.id);
	return true;
}

/**
 * Mobile-safe type selection: focus the next open instance of the type
 * (cycling from the currently focused one), or create one if none exists.
 * Never closes anything — the activity bar's toggle-close-all-of-type
 * semantics are a desktop-only structural operation.
 */
export function openOrCycle(dock: DockState, items: ActivityBarItem[], panelType: string): void {
	const next = nextPanelOfType(dock.root, dock.panels, panelType, dock.focusedPanelId);
	if (next) {
		focusPanel(dock, next);
		return;
	}
	const item = items.find((entry) => entry.panelType === panelType);
	dock.ensurePanelType(panelType, item?.label, item?.icon);
}

/** Close the currently focused panel, if any. */
export function closeCurrent(dock: DockState): void {
	const id = dock.focusedPanelId;
	if (id) dock.closePanel(id);
}

/**
 * Desktop toggle semantics: close ALL panels of the type when any is open,
 * else add one. STRUCTURAL — never wire this to a mobile surface; mobile
 * selection goes through openOrCycle.
 */
export function togglePanelType(dock: DockState, panelType: string, label?: string, icon?: string): void {
	if (hasPanelType(dock.root, panelType, dock.panels)) {
		for (const leaf of collectLeaves(dock.root)) {
			for (const tabId of leaf.tabs) {
				if (dock.panels[tabId]?.type === panelType) dock.closePanel(tabId);
			}
		}
		return;
	}
	dock.addPanel({
		id: `${panelType}-${Date.now()}`,
		type: panelType,
		label: label ?? panelType.charAt(0).toUpperCase() + panelType.slice(1),
		icon: icon ?? (panelType === 'explorer' ? 'i-lucide-folder-tree' : 'i-lucide-eye'),
		closable: true,
	});
}

/** Split the focused leaf by duplicating the focused panel's type into a new pane. */
export function splitFocused(dock: DockState, zone: 'right' | 'bottom'): void {
	const panelId = dock.focusedPanelId;
	const leafId = dock.focusedLeafId;
	if (!panelId || !leafId) return;
	const panel = dock.panels[panelId];
	if (!panel) return;
	dock.addPanel(
		{ id: `${panel.type}-${Date.now()}`, type: panel.type, label: panel.label, icon: panel.icon, closable: true },
		{ leafId, zone },
	);
}
