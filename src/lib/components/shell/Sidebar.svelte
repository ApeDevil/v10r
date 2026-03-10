<script lang="ts">
import { browser } from '$app/environment';
import { SidebarDrawer, SidebarFab, SidebarRail } from '$lib/components/shell';
import { getSidebar } from '$lib/state/sidebar.svelte';

const sidebar = getSidebar();

// SSR-safe media query state
let isMobile = $state(false);

// Set up media query listener on client
$effect(() => {
	if (!browser) return;

	const mq = window.matchMedia('(max-width: 767px)');
	isMobile = mq.matches;

	function handleChange(e: MediaQueryListEvent) {
		isMobile = e.matches;
	}

	mq.addEventListener('change', handleChange);
	return () => mq.removeEventListener('change', handleChange);
});

// Auto-close mobile drawer on resize to tablet/desktop
$effect(() => {
	if (!isMobile && sidebar.mobileOpen) {
		sidebar.closeMobile();
	}
});
</script>

{#if isMobile}
	<!-- Mobile: Drawer + FAB -->
	<SidebarDrawer />
	<SidebarFab />
{:else}
	<!-- Tablet/Desktop: Rail -->
	<SidebarRail />
{/if}
