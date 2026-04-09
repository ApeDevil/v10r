<script lang="ts">
import { getSession } from '$lib/state/session.svelte';
import { getSidebar } from '$lib/state/sidebar.svelte';
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

const sidebar = getSidebar();
const session = getSession();

let drawerRef: HTMLElement;
let overlayRef: HTMLElement;

// Set up focus trap when drawer opens
$effect(() => {
	if (sidebar.mobileOpen && drawerRef) {
		const cleanup = trapFocus(drawerRef);
		return cleanup;
	}
});

// Close on Escape key
function handleKeydown(e: KeyboardEvent) {
	if (e.key === 'Escape' && sidebar.mobileOpen) {
		sidebar.closeMobile();
	}
}

// Close on overlay click
function handleOverlayClick() {
	sidebar.closeMobile();
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

	<!-- Drawer -->
	<aside
		bind:this={drawerRef}
		class={cn('sidebar-drawer fixed top-0 right-0 bg-surface-2 border-l border-border z-drawer flex flex-col motion-reduce:animate-none', className)}
		style:width="var(--sidebar-mobile-width)"
		style:height="100dvh"
		role="navigation"
		aria-label="Main navigation"
		aria-modal="true"
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

		{#if !session.user}
			<ThemeToggle forceExpanded />
		{/if}

		<SidebarNav forceExpanded useFlyout={false} {isAdmin} />

		<div class="p-2 border-t border-border">
			<DiceRollButton forceExpanded />
			<UserMenu user={session.user ? { name: session.user.name ?? '', email: session.user.email } : null} forceExpanded />
		</div>
	</aside>
{/if}

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
</style>
