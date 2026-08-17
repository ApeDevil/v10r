<script lang="ts">
import { afterNavigate } from '$app/navigation';
import { page } from '$app/state';
import { layerStack, setLayerScope } from '$lib/state/layer-stack.svelte';
import { getSidebar } from '$lib/state/sidebar.svelte';
import { useSurface } from '$lib/styles/elevation';
import { cn } from '$lib/utils/cn';
import { trapFocus } from '$lib/utils/focus-trap';
import DiceRollButton from './DiceRollButton.svelte';
import SidebarLogo from './SidebarLogo.svelte';
import SidebarNav from './SidebarNav.svelte';
import SidebarTriggers from './SidebarTriggers.svelte';
import ThemeToggle from './ThemeToggle.svelte';
import UserMenu from './UserMenu.svelte';

interface Props {
	isAdmin?: boolean;
	class?: string;
}

let { isAdmin = false, class: className }: Props = $props();

// The mobile drawer is the sidebar plane on its own scrim (level 1, like the rail). Seeds the
// elevation context so its UserMenu climbs relatively (menu E2 → panel E3).
const s = useSurface();

// Own everything opened from inside the drawer (its UserMenu, that menu's sign-out
// confirm) so the yield effect below can tell those apart from a competing surface.
setLayerScope('sidebar-drawer');

const sidebar = getSidebar();
// Identity from reactive page data, not the frozen session-state context — see
// SidebarRail for the full rationale (context `user` never updates post-mount).
const user = $derived(page.data.session?.user ?? null);

let drawerRef: HTMLElement | undefined = $state();
let overlayRef: HTMLElement | undefined = $state();

// Set up focus trap when drawer opens
$effect(() => {
	if (sidebar.mobileOpen && drawerRef) {
		const cleanup = trapFocus(drawerRef);
		return cleanup;
	}
});

// Register as a dismissal layer while open, so Escape/overlay peel one layer at a
// time when a menu (its own layer) is stacked on top of the drawer.
$effect(() => {
	if (sidebar.mobileOpen) {
		layerStack.push('sidebar-drawer');
		return () => layerStack.pop('sidebar-drawer');
	}
});

// Close on navigation: a surviving drawer keeps its focus trap over the
// destination page.
afterNavigate(() => {
	if (sidebar.mobileOpen) sidebar.closeMobile();
});

// Yield to a FOREIGN layer that opens above us (desk drawers/sheets, the command
// palette, the Vely sheet — all register on the same layerStack) — one scrim at a
// time, with zero import edges between shell and dock. `ownsTop`, not `top !==
// 'sidebar-drawer'`: our own UserMenu is a layer too, and a blanket check closed
// the drawer — unmounting the menu with it — the instant it was tapped. No
// self-loop: closing pops our own id, the stack empties, ownsTop goes true.
$effect(() => {
	if (sidebar.mobileOpen && !layerStack.ownsTop('sidebar-drawer')) {
		sidebar.closeMobile();
	}
});

// Close on Escape key — only when no layer (menu, modal) was stacked above us when
// the keypress began (wasTop, not isTop: a covering Bits menu closes itself
// synchronously before this window handler runs).
function handleKeydown(e: KeyboardEvent) {
	if (e.key === 'Escape' && sidebar.mobileOpen && layerStack.wasTop('sidebar-drawer')) {
		sidebar.closeMobile();
	}
}

// Close on overlay click — same top-layer guard as Escape (the menu already
// dismissed itself on this click's preceding pointerdown).
function handleOverlayClick() {
	if (layerStack.wasTop('sidebar-drawer')) {
		sidebar.closeMobile();
	}
}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if sidebar.mobileOpen}
	<!-- Overlay -->
	<div
		bind:this={overlayRef}
		class="drawer-overlay fixed inset-0 bg-black/50 z-overlay motion-reduce:animate-none"
		onclick={handleOverlayClick}
		role="presentation"
	></div>

	<!-- Drawer — scrimmed + focus-trapped ⇒ APG modal dialog semantics; the
		navigation landmark lives on the SidebarNav inside. -->
	<aside
		bind:this={drawerRef}
		{...s.attrs}
		class={cn('sidebar-drawer fixed top-0 right-0 border-l z-drawer flex flex-col motion-reduce:animate-none', className)}
		style:width="var(--sidebar-mobile-width)"
		style:height="100dvh"
		role="dialog"
		aria-modal="true"
		aria-label="Main navigation"
	>
		<div class="flex items-center justify-between gap-3 p-4 border-b border-border">
			<SidebarLogo forceExpanded />
			<button class="flex items-center justify-center w-[44px] h-[44px] border-none bg-transparent text-fg cursor-pointer rounded-md transition-colors duration-fast hover:bg-fg-alpha focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 motion-reduce:transition-none" onclick={() => sidebar.closeMobile()} aria-label="Close menu">
				<svg
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</button>
		</div>

		<SidebarTriggers forceExpanded />

		<SidebarNav forceExpanded useFlyout={false} {isAdmin} />

		<div class="p-2 border-t border-border">
			{#if !user}
				<ThemeToggle forceExpanded />
			{/if}
			<DiceRollButton forceExpanded />
			<UserMenu user={user ? { name: user.name ?? '', email: user.email } : null} variant="drawer" forceExpanded />
		</div>
	</aside>
{/if}

<!-- Noise glow: dark-mode-only edge contrast against the darkened content behind the drawer -->
<div
	class="grain-glow grain-glow-left"
	class:active={sidebar.mobileOpen}
	aria-hidden="true"
></div>

<style>
	/* Custom animations */
	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes slideIn {
		from {
			transform: translateX(100%);
		}
		to {
			transform: translateX(0);
		}
	}

	.drawer-overlay {
		animation: fadeIn var(--duration-fast);
	}

	.sidebar-drawer {
		animation: slideIn var(--duration-normal) var(--ease-default);
	}

	@media (prefers-reduced-motion: reduce) {
		.drawer-overlay,
		.sidebar-drawer {
			animation: none;
		}
	}

	/* Mobile drawer noise glow — dark mode only; lifted above the overlay for edge contrast.
	   Mobile-only scoping is automatic (parent .sidebar-mobile is display:none ≥768px). */
	.grain-glow-left {
		right: var(--sidebar-mobile-width); /* right edge meets the drawer's left edge */
		z-index: calc(var(--z-drawer) - 1); /* above overlay (30), below drawer (40) */
		--grain-glow-size: 110px; /* medium */
		--grain-glow-opacity: 0.15; /* medium — local override, desktop rail unaffected */
		display: none; /* hidden in light mode */
	}

	:global(.dark) .grain-glow-left {
		display: block; /* dark mode only */
	}
</style>
