/**
 * Mobile-chrome state — context-scoped per DockLayout instance (never
 * module-level: two DockLayouts on one page must not share a drawer).
 *
 * One `surface` discriminator makes the panels drawer and the commands sheet
 * mutually exclusive by construction; getter/setter pairs let bits Drawers
 * `bind:open` directly (proven pattern: modals.svelte.ts + AppShell).
 * Closing a panel is not mobile business: the unsaved-close guard lives on the
 * dock (`dock.requestClose`) so both projections confirm the same way.
 */

import { getContext, setContext } from 'svelte';

const DOCK_MOBILE_CTX = Symbol('dock-mobile');

type MobileSurface = 'panels' | 'commands' | null;

export function createDockMobileState() {
	let surface = $state<MobileSurface>(null);

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
	};
}

export type DockMobileState = ReturnType<typeof createDockMobileState>;

export function setDockMobileContext(): DockMobileState {
	const state = createDockMobileState();
	setContext(DOCK_MOBILE_CTX, state);
	return state;
}

export function getDockMobile(): DockMobileState {
	return getContext<DockMobileState>(DOCK_MOBILE_CTX);
}
