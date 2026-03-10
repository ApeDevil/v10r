<script lang="ts">
import { Button } from '$lib/components/primitives/button';
import { getSidebar } from '$lib/state/sidebar.svelte';
import { cn } from '$lib/utils/cn';

interface Props {
	class?: string;
}

let { class: className }: Props = $props();

const sidebar = getSidebar();

function handleClick() {
	sidebar.toggleMobile();
}
</script>

<Button
	variant="default"
	class={cn(
		'fixed bottom-4 right-4 w-[56px] h-[56px] rounded-full shadow-lg z-fab hover:scale-105 hover:shadow-xl active:scale-95 motion-reduce:hover:scale-100 motion-reduce:active:scale-100',
		className
	)}
	onclick={handleClick}
	aria-label={sidebar.mobileOpen ? 'Close menu' : 'Open menu'}
	aria-expanded={sidebar.mobileOpen}
>
	{#snippet children()}
		{#if sidebar.mobileOpen}
			<span class="i-lucide-x text-icon-lg" ></span>
		{:else}
			<span class="i-lucide-menu text-icon-lg" ></span>
		{/if}
	{/snippet}
</Button>
