<script lang="ts">
	/**
	 * Navigation container for sidebar.
	 * Rail mode: Icons only
	 * Expanded mode: Icons + labels
	 */

	import { getSidebar } from '$lib/stores/sidebar.svelte';
	import NavItem from './NavItem.svelte';

	interface Props {
		forceExpanded?: boolean; // Force expanded mode (for drawer)
	}

	let { forceExpanded = false }: Props = $props();

	const sidebar = getSidebar();

	const isExpanded = $derived(forceExpanded || sidebar.expanded);

	// Navigation structure with dropdowns
	const navItems = [
		{ href: '/', label: 'Home', icon: '🏠' },
		{ href: '/shell-demo', label: 'Shell Demo', icon: '🎨' },
		{
			href: '/showcases',
			label: 'Showcases',
			icon: '✨',
			children: [
				{ href: '/showcases/forms', label: 'Forms' },
				{ href: '/showcases/3d', label: '3D' },
				{ href: '/showcases/auth', label: 'Auth' }
			]
		},
		{
			href: '/docs',
			label: 'Docs',
			icon: '📚',
			children: [
				{ href: '/docs/stack', label: 'Stack' },
				{ href: '/docs/blueprint', label: 'Blueprint' }
			]
		}
	];
</script>

<nav class="sidebar-nav" role="navigation" aria-label="Main navigation">
	<ul class="nav-list">
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
	.sidebar-nav {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem;
	}

	.nav-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	/* Scrollbar styling */
	.sidebar-nav::-webkit-scrollbar {
		width: 6px;
	}

	.sidebar-nav::-webkit-scrollbar-track {
		background: transparent;
	}

	.sidebar-nav::-webkit-scrollbar-thumb {
		background: var(--color-border);
		border-radius: 3px;
	}

	.sidebar-nav::-webkit-scrollbar-thumb:hover {
		background: var(--color-muted);
	}
</style>
