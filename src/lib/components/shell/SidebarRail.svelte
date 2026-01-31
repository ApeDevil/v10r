<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import { getSidebar } from '$lib/stores/sidebar.svelte';
	import SidebarLogo from './SidebarLogo.svelte';
	import SidebarNav from './SidebarNav.svelte';
	import SidebarTriggers from './SidebarTriggers.svelte';
	import UserMenu from './UserMenu.svelte';

	const sidebar = getSidebar();

	// Detect if device supports hover
	const hasHover = new MediaQuery('(hover: hover)');
	const isDesktop = new MediaQuery('(min-width: 1024px)');

	function handleMouseEnter() {
		// Only hover-expand on desktop devices with hover capability
		if (hasHover.matches && isDesktop.matches && !sidebar.pinned) {
			sidebar.expand();
		}
	}

	function handleMouseLeave() {
		// Only auto-collapse if not pinned
		if (!sidebar.pinned) {
			sidebar.collapse();
		}
	}

	function handleClick() {
		// Click-to-toggle on tablet or touch devices
		if (!hasHover.matches || !isDesktop.matches) {
			if (sidebar.expanded) {
				sidebar.collapse();
			} else {
				sidebar.expand();
			}
		}
	}

	// Unpin and collapse when leaving desktop
	$effect(() => {
		if (!isDesktop.matches && sidebar.pinned) {
			sidebar.togglePin(); // Unpin
			sidebar.collapse();
		}
	});
</script>

<aside
	class="sidebar-rail"
	class:expanded={sidebar.expanded}
	onmouseenter={handleMouseEnter}
	onmouseleave={handleMouseLeave}
	onclick={handleClick}
	role="navigation"
	aria-label="Main navigation"
>
	<div class="sidebar-header">
		<SidebarLogo />
	</div>

	<SidebarTriggers />

	<SidebarNav />

	<div class="sidebar-footer">
		<UserMenu
			user={{ name: 'Demo User', email: 'demo@velociraptor.dev' }}
			forceExpanded={sidebar.expanded}
		/>
	</div>
</aside>

<style>
	.sidebar-rail {
		position: fixed;
		top: 0;
		left: 0;
		height: 100dvh;
		width: var(--sidebar-rail-width);
		background: var(--color-bg);
		border-right: 1px solid var(--color-border);
		z-index: var(--z-sidebar, 10);
		display: flex;
		flex-direction: column;
		transition:
			width var(--duration-normal, 250ms) var(--ease-default, ease),
			box-shadow var(--duration-normal, 250ms);
		overflow: hidden;
	}

	.sidebar-rail.expanded {
		width: var(--sidebar-expanded-width);
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
	}

	.sidebar-header {
		padding: 1rem;
		border-bottom: 1px solid var(--color-border);
	}

	.sidebar-footer {
		padding: 0.5rem;
		border-top: 1px solid var(--color-border);
	}

	/* Respect reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.sidebar-rail {
			transition: none;
		}
	}
</style>
