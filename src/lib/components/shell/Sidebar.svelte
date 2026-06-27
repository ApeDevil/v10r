<script lang="ts">
import { MediaQuery } from 'svelte/reactivity';
import { SidebarDrawer, SidebarFab, SidebarRail } from '$lib/components/shell';
import { getSidebar } from '$lib/state/sidebar.svelte';

interface Props {
	isAdmin?: boolean;
}

let { isAdmin = false }: Props = $props();

const sidebar = getSidebar();

// Rendering is CSS-driven: BOTH the mobile (drawer + FAB) and desktop (rail) trees
// are server-rendered and shown per viewport via `display: contents`/`none`. This
// removes the old JS-only swap — previously SSR always emitted the rail and mobile
// clients hydrated it, then tore it down and mounted the drawer/FAB after JS ran.
// `display: contents` keeps the rail/drawer/FAB as the layout participants (the
// wrappers add no box). The reactive query below only drives the close-on-widen
// side-effect. Desktop-first SSR fallback so layout-shell math matches the rail.
const isDesktop = new MediaQuery('(min-width: 768px)', true);

$effect(() => {
	if (isDesktop.current && sidebar.mobileOpen) {
		sidebar.closeMobile();
	}
});
</script>

<div class="sidebar-mobile">
	<SidebarDrawer {isAdmin} />
	<SidebarFab />
</div>
<div class="sidebar-desktop">
	<SidebarRail {isAdmin} />
</div>

<style>
	/* Mobile-first: drawer + FAB visible, rail hidden. */
	.sidebar-mobile {
		display: contents;
	}
	.sidebar-desktop {
		display: none;
	}

	@media (min-width: 768px) {
		.sidebar-mobile {
			display: none;
		}
		.sidebar-desktop {
			display: contents;
		}
	}
</style>
