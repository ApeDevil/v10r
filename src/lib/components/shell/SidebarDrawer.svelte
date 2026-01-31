<script lang="ts">
	import { trapFocus } from '$lib/utils/focus-trap';
	import { getSidebar } from '$lib/stores/sidebar.svelte';
	import SidebarLogo from './SidebarLogo.svelte';
	import SidebarNav from './SidebarNav.svelte';
	import SidebarTriggers from './SidebarTriggers.svelte';
	import UserMenu from './UserMenu.svelte';

	const sidebar = getSidebar();

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
		class="drawer-overlay"
		onclick={handleOverlayClick}
		role="presentation"
	></div>

	<!-- Drawer -->
	<aside
		bind:this={drawerRef}
		class="sidebar-drawer"
		role="navigation"
		aria-label="Main navigation"
		aria-modal="true"
	>
		<div class="sidebar-header">
			<SidebarLogo forceExpanded />
			<button class="close-button" onclick={() => sidebar.closeMobile()} aria-label="Close menu">
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

		<SidebarNav forceExpanded />

		<div class="sidebar-footer">
			<UserMenu user={{ name: 'Demo User', email: 'demo@velociraptor.dev' }} forceExpanded />
		</div>
	</aside>
{/if}

<style>
	.drawer-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgb(0 0 0 / 0.5);
		z-index: var(--z-overlay, 30);
		animation: fadeIn var(--duration-fast, 150ms);
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.sidebar-drawer {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		width: var(--sidebar-mobile-width);
		background: var(--color-bg);
		border-left: 1px solid var(--color-border);
		z-index: var(--z-drawer, 40);
		display: flex;
		flex-direction: column;
		animation: slideIn var(--duration-normal, 250ms) var(--ease-default, ease);
	}

	@keyframes slideIn {
		from {
			transform: translateX(100%);
		}
		to {
			transform: translateX(0);
		}
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 1rem;
		border-bottom: 1px solid var(--color-border);
	}

	.close-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border: none;
		background: transparent;
		color: var(--color-fg);
		cursor: pointer;
		border-radius: 0.375rem;
		transition: background var(--duration-fast, 150ms);
	}

	.close-button:hover {
		background: var(--color-border);
	}

	.close-button:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.sidebar-footer {
		padding: 0.5rem;
		border-top: 1px solid var(--color-border);
	}

	/* Respect reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.drawer-overlay,
		.sidebar-drawer {
			animation: none;
		}
	}
</style>
