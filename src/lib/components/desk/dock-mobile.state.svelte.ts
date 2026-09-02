/**
 * Mobile-chrome state — context-scoped per DockLayout instance (never
 * module-level: two DockLayouts on one page must not share a drawer).
 *
 * One `surface` discriminator makes the panels drawer and the commands sheet
 * mutually exclusive by construction; getter/setter pairs let bits Drawers
 * `bind:open` directly (proven pattern: modals.svelte.ts + AppShell).
 */

import { getContext, setContext } from 'svelte';
import type { PanelDefinition } from '$lib/desk/layout.types';
import type { DockState } from './dock.state.svelte';

const DOCK_MOBILE_CTX = Symbol('dock-mobile');

type MobileSurface = 'panels' | 'commands' | null;

export function createDockMobileState(dock: DockState) {
	let surface = $state<MobileSurface>(null);
	/** Panel awaiting an unsaved-close confirmation (null = no pending confirm). */
	let pendingClose = $state<PanelDefinition | null>(null);

	return {
		get panelsOpen() {
			return surface === 'panels';
		},
		set panelsOpen(value: boolean) {
			if (value) surface = 'panels';
			else if (surface === 'panels') surface = null;
		},
		get commandsOpen() {
			return surface === 'commands';
		},
		set commandsOpen(value: boolean) {
			if (value) surface = 'commands';
			else if (surface === 'commands') surface = null;
		},
		toggle(target: Exclude<MobileSurface, null>) {
			surface = surface === target ? null : target;
		},
		close() {
			surface = null;
		},

		get pendingClose() {
			return pendingClose;
		},
		/**
		 * Close a panel, gating unsaved work behind a confirm dialog. Undo can
		 * restore the panel shell but not a destroyed buffer — hence confirm,
		 * not just the undo toast.
		 */
		requestClose(panelId: string) {
			const panel = dock.panels[panelId];
			if (!panel) return;
			if (panel.indicator === 'unsaved') {
				pendingClose = panel;
				return;
			}
			dock.closePanel(panelId);
		},
		confirmPendingClose() {
			if (pendingClose) {
				dock.closePanel(pendingClose.id);
				pendingClose = null;
			}
		},
		cancelPendingClose() {
			pendingClose = null;
		},
	};
}

export type DockMobileState = ReturnType<typeof createDockMobileState>;

export function setDockMobileContext(dock: DockState): DockMobileState {
	const state = createDockMobileState(dock);
	setContext(DOCK_MOBILE_CTX, state);
	return state;
}

export function getDockMobile(): DockMobileState {
	return getContext<DockMobileState>(DOCK_MOBILE_CTX);
}
