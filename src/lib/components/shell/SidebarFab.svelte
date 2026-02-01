<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { getSidebar } from '$lib/stores/sidebar.svelte';

	interface Props {
		class?: string;
	}

	let { class: className }: Props = $props();

	const sidebar = getSidebar();

	function handleClick() {
		sidebar.toggleMobile();
	}
</script>

<button
	class={cn('fixed bottom-4 right-4 w-[56px] h-[56px] rounded-full border-none bg-primary text-white flex items-center justify-center cursor-pointer shadow-lg z-fab transition-all duration-fast hover:scale-105 hover:shadow-xl active:scale-95 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100', className)}
	onclick={handleClick}
	aria-label={sidebar.mobileOpen ? 'Close menu' : 'Open menu'}
	aria-expanded={sidebar.mobileOpen}
>
	{#if sidebar.mobileOpen}
		<!-- X icon when open -->
		<svg
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<line x1="18" y1="6" x2="6" y2="18"></line>
			<line x1="6" y1="6" x2="18" y2="18"></line>
		</svg>
	{:else}
		<!-- Hamburger icon when closed -->
		<svg
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<line x1="3" y1="12" x2="21" y2="12"></line>
			<line x1="3" y1="6" x2="21" y2="6"></line>
			<line x1="3" y1="18" x2="21" y2="18"></line>
		</svg>
	{/if}
</button>
