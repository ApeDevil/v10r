<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import { cn } from '$lib/utils/cn';
	import { getSidebar } from '$lib/stores/sidebar.svelte';
	import SidebarLogo from './SidebarLogo.svelte';
	import SidebarNav from './SidebarNav.svelte';
	import SidebarTriggers from './SidebarTriggers.svelte';
	import UserMenu from './UserMenu.svelte';

	interface Props {
		class?: string;
	}

	let { class: className }: Props = $props();

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
	class={cn('fixed top-0 left-0 bg-surface-1 border-r border-border z-sidebar flex flex-col overflow-hidden transition-all duration-normal motion-reduce:transition-none group', sidebar.expanded && 'shadow-lg', className)}
	style:width={sidebar.expanded ? 'var(--sidebar-expanded-width)' : 'var(--sidebar-rail-width)'}
	style:height="100dvh"
	onmouseenter={handleMouseEnter}
	onmouseleave={handleMouseLeave}
	onclick={handleClick}
	role="navigation"
	aria-label="Main navigation"
>
	<div class="py-2 border-b border-border">
		<SidebarLogo />
	</div>

	<SidebarTriggers />

	<SidebarNav />

	<div class="py-2 border-t border-border">
		<UserMenu
			user={{ name: 'Demo User', email: 'demo@velociraptor.dev' }}
			forceExpanded={sidebar.expanded}
		/>
	</div>

	<!-- Expand affordance indicator (only visible when collapsed) -->
	{#if !sidebar.expanded}
		<div
			class="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-16 bg-primary/0 group-hover:bg-primary/30 rounded-l-full transition-all duration-normal motion-reduce:transition-none"
			aria-hidden="true"
		/>
	{/if}
</aside>
