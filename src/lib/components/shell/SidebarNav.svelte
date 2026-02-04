<script lang="ts">
	/**
	 * Navigation container for sidebar.
	 * Rail mode: Icons only
	 * Expanded mode: Icons + labels
	 */

	import { cn } from '$lib/utils/cn';
	import { getSidebar } from '$lib/stores/sidebar.svelte';
	import NavItem from './NavItem.svelte';

	interface Props {
		forceExpanded?: boolean; // Force expanded mode (for drawer)
		class?: string;
	}

	let { forceExpanded = false, class: className }: Props = $props();

	const sidebar = getSidebar();

	const isExpanded = $derived(forceExpanded || sidebar.expanded);

	// Navigation structure with dropdowns
	const navItems = [
		{ href: '/', label: 'Home', icon: 'i-lucide-home' },
		{
			href: '/showcases',
			label: 'Showcases',
			icon: 'i-lucide-sparkles',
			children: [
				{ href: '/showcases/shell', label: 'Shell' },
				{ href: '/showcases/forms', label: 'Forms' },
				{ href: '/showcases/3d', label: '3D' },
				{ href: '/showcases/auth', label: 'Auth' }
			]
		},
		{
			href: '/docs',
			label: 'Docs',
			icon: 'i-lucide-book-open',
			children: [
				{ href: '/docs/stack', label: 'Stack' }
			]
		}
	];
</script>

<nav class={cn('flex-1 overflow-y-auto p-2 scrollbar-nav', className)} role="navigation" aria-label="Main navigation">
	<ul class="list-none m-0 p-0 flex flex-col gap-1">
		{#each navItems as item}
			<li>
				<NavItem
					href={item.href}
					icon={item.icon}
					label={item.label}
					children={item.children}
					forceExpanded={isExpanded}
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
