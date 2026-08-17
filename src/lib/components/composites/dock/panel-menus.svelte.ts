/**
 * Panel menu registry — context-scoped per DockLayout instance.
 *
 * Panels register their menus via $effect on mount; renderers (desktop kebab,
 * mobile commands sheet, DeskShortcuts) read `active`, which follows the
 * dock's focused panel. Focus itself is written by ONE follower effect in
 * DockLayout — never by individual surfaces.
 *
 * Context-scoped (not module-level $state) because two DockLayouts can mount
 * on one page (the workbench showcase) and must not share a registry.
 */

import { getContext, setContext } from 'svelte';
import type { MenuBarMenu } from '$lib/components/composites/menu-bar/types';

const PANEL_MENUS_CTX = Symbol('panel-menus');

export interface PanelMenus {
	menuBar: MenuBarMenu[];
}

const EMPTY: PanelMenus = { menuBar: [] };

export function createPanelMenusState() {
	/** Reactive registry version — bumped on every register/unregister */
	let registryVersion = $state(0);
	/** Non-reactive storage for panel menus, keyed by panel INSTANCE id */
	const registry = new Map<string, PanelMenus>();
	/** The currently focused panel — driven by DockLayout's focus follower */
	let focusedPanelId = $state<string | null>(null);

	const active = $derived.by((): PanelMenus => {
		void registryVersion;
		if (!focusedPanelId) return EMPTY;
		return registry.get(focusedPanelId) ?? EMPTY;
	});

	return {
		/**
		 * Register menus for a panel instance. Call inside a $effect so it
		 * re-runs when $derived menu arrays change. Returns a cleanup function.
		 * queueMicrotask defers the version bump so we never write $state
		 * during effect execution.
		 */
		register(panelId: string, menus: PanelMenus): () => void {
			registry.set(panelId, menus);
			queueMicrotask(() => {
				registryVersion++;
			});
			return () => {
				registry.delete(panelId);
				queueMicrotask(() => {
					registryVersion++;
				});
			};
		},

		/** Written by DockLayout's focus follower only. */
		setFocused(panelId: string | null): void {
			if (focusedPanelId === panelId) return;
			focusedPanelId = panelId;
		},

		/** Menus for the focused panel (reactive). */
		get active(): PanelMenus {
			return active;
		},

		/** Explicit instance lookup (reactive on registry changes). */
		getMenus(panelId: string): PanelMenus {
			void registryVersion;
			return registry.get(panelId) ?? EMPTY;
		},

		get focusedPanelId(): string | null {
			return focusedPanelId;
		},
	};
}

export type PanelMenusState = ReturnType<typeof createPanelMenusState>;

export function setPanelMenusContext(): PanelMenusState {
	const state = createPanelMenusState();
	setContext(PANEL_MENUS_CTX, state);
	return state;
}

export function getPanelMenus(): PanelMenusState {
	return getContext<PanelMenusState>(PANEL_MENUS_CTX);
}
