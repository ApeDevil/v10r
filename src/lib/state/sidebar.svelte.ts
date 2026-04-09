/**
 * Sidebar state management (SSR-safe using context pattern)
 */

import { getContext, setContext } from 'svelte';
import { browser } from '$app/environment';
import { setCookie } from '$lib/utils/cookies';

interface SidebarState {
	expanded: boolean; // Rail vs full sidebar (desktop)
	pinned: boolean; // Stay expanded vs collapse on blur
	mobileOpen: boolean; // Drawer open (mobile)
	expandedWidth: number; // Configurable sidebar width (200–320px)
}

const STORAGE_KEY = 'sidebar-state';
const SIDEBAR_CTX = Symbol('sidebar');
const BROADCAST_CHANNEL = 'sidebar-width';

/** Padding constants — explicit design decisions */
/** Icon padding scales with icon size: 12px at narrow, 16px at wide */
function iconPadding(expandedWidth: number): number {
	return Math.round(iconSize(expandedWidth) * 0.67);
}
const RAIL_PADDING = 16; // item → rail (8px each side, matches p-2)

/** Icon size from expanded width, floored at 18px. ALSO MIRRORED in app.html inline script. */
export function iconSize(expandedWidth: number): number {
	return Math.max(18, Math.round(18 + (expandedWidth - 160) * (6 / 160)));
}

/** Item = icon + padding (always square). ALSO MIRRORED in app.html inline script. */
export function itemSize(expandedWidth: number): number {
	return iconSize(expandedWidth) + iconPadding(expandedWidth);
}

/** Rail = item + padding. ALSO MIRRORED in app.html inline script. */
export function railWidth(expandedWidth: number): number {
	return itemSize(expandedWidth) + RAIL_PADDING;
}

/**
 * Create sidebar state instance.
 * Use via context to ensure SSR safety.
 */
export function createSidebarState(initialWidth = 240) {
	// Load from localStorage (client-side only)
	const stored = browser ? localStorage.getItem(STORAGE_KEY) : null;
	const parsed = stored ? JSON.parse(stored) : null;
	const initial: SidebarState = {
		expanded: parsed?.expanded ?? false,
		pinned: parsed?.pinned ?? false,
		mobileOpen: false,
		expandedWidth: parsed?.expandedWidth ?? initialWidth,
	};

	const state = $state<SidebarState>(initial);

	// Persist on change (excluding mobileOpen which is ephemeral)
	$effect(() => {
		if (browser) {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					expanded: state.expanded,
					pinned: state.pinned,
					expandedWidth: state.expandedWidth,
				}),
			);
		}
	});

	// Sync CSS custom properties (expanded + rail)
	$effect(() => {
		if (browser) {
			const el = document.documentElement;
			el.style.setProperty('--sidebar-expanded-width', `${state.expandedWidth}px`);
			el.style.setProperty('--sidebar-rail-width', `${railWidth(state.expandedWidth)}px`);
			el.style.setProperty('--sidebar-item-size', `${itemSize(state.expandedWidth)}px`);
			el.style.setProperty('--sidebar-icon-size', `${iconSize(state.expandedWidth)}px`);
		}
	});

	// Multi-tab sync via BroadcastChannel
	$effect(() => {
		if (!browser) return;
		const bc = new BroadcastChannel(BROADCAST_CHANNEL);
		bc.onmessage = (e) => {
			const width = Number(e.data);
			if (width >= 160 && width <= 320) {
				state.expandedWidth = width;
			}
		};
		return () => bc.close();
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
		get expandedWidth() {
			return state.expandedWidth;
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

		setWidth(px: number) {
			const clamped = Math.max(160, Math.min(320, px));
			state.expandedWidth = clamped;

			if (browser) {
				// Cookie for SSR flash prevention
				setCookie('sidebar-width', String(clamped), { maxAge: 31536000 });

				// Broadcast to other tabs
				const bc = new BroadcastChannel(BROADCAST_CHANNEL);
				bc.postMessage(clamped);
				bc.close();

				// Fire-and-forget DB persistence
				fetch('/api/preferences', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ sidebarWidth: clamped }),
				}).catch(() => {});
			}
		},
	};
}

/**
 * Set sidebar context in component tree.
 * Call this in root layout.
 */
export function setSidebarContext(initialWidth?: number) {
	const sidebar = createSidebarState(initialWidth);
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
