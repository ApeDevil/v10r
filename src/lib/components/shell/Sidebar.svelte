<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import { getSidebar } from '$lib/stores/sidebar.svelte';
	import { SidebarRail, SidebarDrawer, SidebarFab } from '$lib/components/shell';

	const sidebar = getSidebar();
	const isMobile = new MediaQuery('(max-width: 767px)');

	// Auto-close mobile drawer on resize to tablet/desktop
	$effect(() => {
		if (!isMobile.matches && sidebar.mobileOpen) {
			sidebar.closeMobile();
		}
	});
</script>

{#if isMobile.matches}
	<!-- Mobile: Drawer + FAB -->
	<SidebarDrawer />
	<SidebarFab />
{:else}
	<!-- Tablet/Desktop: Rail -->
	<SidebarRail />
{/if}
