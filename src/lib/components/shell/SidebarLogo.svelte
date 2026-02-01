<script lang="ts">
	/**
	 * Logo/branding for sidebar.
	 * Rail mode: Icon only (collapsed)
	 * Expanded mode: Icon + text
	 */

	import Icon from '@iconify/svelte';
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

<a href="/" class={cn('flex items-center gap-3 p-3 no-underline rounded-md transition-colors duration-fast hover:bg-border focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 motion-reduce:transition-none', className)} aria-label="Home">
	<div class="text-[2rem] shrink-0 leading-none">
		<Icon icon="lucide:zap" />
	</div>
	{#if showText}
		<span class="logo-text font-semibold text-lg text-fg whitespace-nowrap opacity-0 animate-fade-in motion-reduce:animate-none motion-reduce:opacity-100">Velociraptor</span>
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
