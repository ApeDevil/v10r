/**
 * Sidebar state management (SSR-safe using context pattern)
 */

import { getContext, setContext } from 'svelte';
import { browser } from '$app/environment';

interface SidebarState {
	expanded: boolean; // Rail vs full sidebar (desktop)
	pinned: boolean; // Stay expanded vs collapse on blur
	mobileOpen: boolean; // Drawer open (mobile)
}

const STORAGE_KEY = 'sidebar-state';
const SIDEBAR_CTX = Symbol('sidebar');

/**
 * Create sidebar state instance.
 * Use via context to ensure SSR safety.
 */
export function createSidebarState() {
	// Load from localStorage (client-side only)
	const stored = browser ? localStorage.getItem(STORAGE_KEY) : null;
	const initial: SidebarState = stored ? JSON.parse(stored) : { expanded: false, pinned: false, mobileOpen: false };

	const state = $state<SidebarState>(initial);

	// Persist on change (excluding mobileOpen which is ephemeral)
	$effect(() => {
		if (browser) {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					expanded: state.expanded,
					pinned: state.pinned,
					// Don't persist mobileOpen - always start closed
				}),
			);
		}
	});

	return {
		get expanded() {
			return state.expanded;
		},
		get pinned() {
			return state.pinned;
		},
		get mobileOpen() {
			return state.mobileOpen;
		},

		expand() {
			state.expanded = true;
		},

		collapse() {
			// Only collapse if not pinned
			if (!state.pinned) {
				state.expanded = false;
			}
		},

		togglePin() {
			state.pinned = !state.pinned;
		},

		openMobile() {
			state.mobileOpen = true;
		},

		closeMobile() {
			state.mobileOpen = false;
		},

		toggleMobile() {
			state.mobileOpen = !state.mobileOpen;
		},
	};
}

/**
 * Set sidebar context in component tree.
 * Call this in root layout.
 */
export function setSidebarContext() {
	const sidebar = createSidebarState();
	setContext(SIDEBAR_CTX, sidebar);
	return sidebar;
}

/**
 * Get sidebar state from context.
 * Use this in child components.
 */
export function getSidebar() {
	return getContext<ReturnType<typeof createSidebarState>>(SIDEBAR_CTX);
}
