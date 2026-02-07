<script lang="ts">
	/**
	 * Logo/branding for sidebar.
	 * Rail mode: "v10r" (collapsed)
	 * Expanded mode: "velociraptor"
	 */

	import { cn } from '$lib/utils/cn';
	import { getSidebar } from '$lib/stores/sidebar.svelte';

	interface Props {
		forceExpanded?: boolean; // Force expanded mode (for drawer)
		class?: string;
	}

	let { forceExpanded = false, class: className }: Props = $props();

	const sidebar = getSidebar();

	const showText = $derived(forceExpanded || sidebar.expanded);
</script>

<a href="/" class={cn('flex items-center p-3 no-underline rounded-md transition-colors duration-fast hover:bg-border focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 motion-reduce:transition-none', className)} aria-label="Home">
	{#if showText}
		<span class="logo-text font-bold text-lg text-fg whitespace-nowrap opacity-0">Velociraptor</span>
	{:else}
		<span class="font-bold text-lg text-fg">v10r</span>
	{/if}
</a>

<style>
	/* Custom fadeIn animation that UnoCSS doesn't provide by default */
	@keyframes fadeIn {
		to {
			opacity: 1;
		}
	}

	.logo-text {
		animation: fadeIn var(--duration-fast) forwards;
	}

	@media (prefers-reduced-motion: reduce) {
		.logo-text {
			animation: none;
			opacity: 1;
		}
	}
</style>
