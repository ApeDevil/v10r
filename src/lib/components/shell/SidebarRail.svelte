<script lang="ts">
import { MediaQuery } from 'svelte/reactivity';
import { getSession } from '$lib/state/session.svelte';
import { getSidebar } from '$lib/state/sidebar.svelte';
import { cn } from '$lib/utils/cn';
import DiceRollButton from './DiceRollButton.svelte';
import SidebarLogo from './SidebarLogo.svelte';
import SidebarNav from './SidebarNav.svelte';
import SidebarTriggers from './SidebarTriggers.svelte';
import UserMenu from './UserMenu.svelte';

interface Props {
	class?: string;
}

let { class: className }: Props = $props();

const sidebar = getSidebar();
const session = getSession();

// Detect if device supports hover
const hasHover = new MediaQuery('(hover: hover)');
const isDesktop = new MediaQuery('(min-width: 1024px)');

function handleMouseEnter() {
	// Only hover-expand on desktop devices with hover capability
	if (hasHover.current && isDesktop.current && !sidebar.pinned) {
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
	if (!hasHover.current || !isDesktop.current) {
		if (sidebar.expanded) {
			sidebar.collapse();
		} else {
			sidebar.expand();
		}
	}
}

// Unpin and collapse when leaving desktop
$effect(() => {
	if (!isDesktop.current && sidebar.pinned) {
		sidebar.togglePin(); // Unpin
		sidebar.collapse();
	}
});
</script>

<aside
	class={cn('fixed top-0 left-0 bg-surface-1 border-r border-border z-sidebar flex flex-col overflow-hidden transition-all duration-normal motion-reduce:transition-none', className)}
	style:width={sidebar.expanded ? 'var(--sidebar-expanded-width)' : 'var(--sidebar-rail-width)'}
	style:height="100dvh"
	onmouseenter={handleMouseEnter}
	onmouseleave={handleMouseLeave}
	onclick={handleClick}
	role="navigation"
	aria-label="Main navigation"
>
	<div class="p-2 border-b border-border">
		<SidebarLogo />
	</div>

	<SidebarTriggers />

	<SidebarNav />

	<div class="p-2 border-t border-border">
		<DiceRollButton class="!px-0" />
		<UserMenu
			user={session.user ? { name: session.user.name ?? '', email: session.user.email } : null}
			forceExpanded={sidebar.expanded}
		/>
	</div>
</aside>

<!-- Noise glow: lives outside aside so it isn't clipped by overflow-hidden -->
<div
	class="grain-glow grain-glow-right"
	class:active={sidebar.expanded}
	aria-hidden="true"
></div>

<style>
	/* Scale sidebar icons with the width setting */
	aside :global(.text-icon-md) {
		font-size: var(--sidebar-icon-size, 1.25rem);
	}

	/* Rail items: always square, size driven by sidebar width setting */
	aside :global(.rail-item) {
		width: var(--sidebar-item-size, 2.5rem);
		height: var(--sidebar-item-size, 2.5rem);
	}

	/* Sidebar-specific noise glow positioning */
	.grain-glow-right {
		left: var(--sidebar-rail-width);
		--grain-glow-offset: calc(var(--sidebar-expanded-width) - var(--sidebar-rail-width));
	}
</style>
