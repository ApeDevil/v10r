/**
 * Panel menu registry for the Desk MenuBar.
 *
 * Panels register their menus via $effect on mount.
 * The DeskMenuBar reads `getActiveMenus()` which derives from the focused panel.
 */

import type { MenuBarMenu } from '$lib/components/composites/menu-bar/types';

// ── Types ────────────────────────────────────────────────────────────

export interface PanelMenus {
	menuBar: MenuBarMenu[];
}

// ── Module-level state ───────────────────────────────────────────────

/** Reactive registry version — bumped on every register/unregister to signal changes */
let registryVersion = $state(0);

/** Non-reactive storage for panel menus */
const registry = new Map<string, PanelMenus>();

/** The currently focused panel — drives which menus are active */
let focusedPanelId = $state<string | null>(null);

// ── Public API ───────────────────────────────────────────────────────

/**
 * Register menus for a panel. Call inside a $effect so it re-runs
 * when $derived menu arrays change. Returns a cleanup function.
 *
 * Uses queueMicrotask to defer the version bump so we don't write
 * $state during effect execution (which would cause infinite loops).
 */
export function registerPanelMenus(panelId: string, menus: PanelMenus): () => void {
	registry.set(panelId, menus);
	queueMicrotask(() => { registryVersion++; });
	return () => {
		registry.delete(panelId);
		queueMicrotask(() => { registryVersion++; });
	};
}

/** Set which panel is currently focused (called by DockLeaf on focusin) */
export function setFocusedPanel(panelId: string | null): void {
	if (focusedPanelId === panelId) return;
	focusedPanelId = panelId;
}

/** Get the currently focused panel ID */
export function getFocusedPanelId(): string | null {
	return focusedPanelId;
}

/** Reactive (module-level derived): the menus for the currently focused panel */
const activeMenus = $derived.by((): PanelMenus => {
	// Read version to establish reactive dependency on registry changes
	void registryVersion;
	if (!focusedPanelId) return { menuBar: [] };
	return registry.get(focusedPanelId) ?? { menuBar: [] };
});

/** Get the active menus — must be called inside a reactive context ($derived, $effect, template) */
export function getActiveMenus(): PanelMenus {
	return activeMenus;
}

/** Check if a given panel has registered menus */
export function hasPanelMenus(panelId: string): boolean {
	return registry.has(panelId);
}
