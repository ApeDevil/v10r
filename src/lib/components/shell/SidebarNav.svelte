<script lang="ts">
/**
 * Navigation container for sidebar.
 * Rail mode: Icons only
 * Expanded mode: Icons + labels
 */

import { adminNavItem, navItems } from '$lib/nav';
import { getSidebar } from '$lib/state/sidebar.svelte';
import { cn } from '$lib/utils/cn';
import NavItem from './NavItem.svelte';

interface Props {
	forceExpanded?: boolean; // Force expanded mode (for drawer)
	useFlyout?: boolean;
	isAdmin?: boolean;
	class?: string;
}

let { forceExpanded = false, useFlyout = true, isAdmin = false, class: className }: Props = $props();

const sidebar = getSidebar();

const isExpanded = $derived(forceExpanded || sidebar.expanded);
const effectiveItems = $derived(isAdmin ? [...navItems, adminNavItem] : navItems);
</script>

<nav class={cn('flex-1 overflow-y-auto p-2 scrollbar-nav', className)} role="navigation" aria-label="Main navigation">
	<ul class="list-none m-0 p-0 flex flex-col gap-1">
		{#each effectiveItems as item}
			<li>
				<NavItem
					href={item.href}
					icon={item.icon}
					label={item.label}
					children={item.children}
					forceExpanded={isExpanded}
					{useFlyout}
				/>
			</li>
		{/each}
	</ul>
</nav>

<style>
	/* Custom scrollbar styling - UnoCSS doesn't provide these pseudo-elements */
	.scrollbar-nav::-webkit-scrollbar {
		width: 6px;
	}

	.scrollbar-nav::-webkit-scrollbar-track {
		background: transparent;
	}

	.scrollbar-nav::-webkit-scrollbar-thumb {
		background: var(--color-border);
		border-radius: 3px;
	}

	.scrollbar-nav::-webkit-scrollbar-thumb:hover {
		background: var(--color-muted);
	}
</style>
