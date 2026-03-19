<script lang="ts">
/**
 * Dice roll button for shuffling the site's style.
 * Dual-mode: icon-only in rail, labeled when expanded.
 * Follows SidebarTriggers.svelte pattern.
 */

import { getSidebar } from '$lib/state/sidebar.svelte';
import { getStyle } from '$lib/state/style.svelte';
import { getToast } from '$lib/state/toast.svelte';
import { cn } from '$lib/utils/cn';

interface Props {
	forceExpanded?: boolean;
	class?: string;
}

let { forceExpanded = false, class: className }: Props = $props();

const sidebar = getSidebar();
const style = getStyle();
const toast = getToast();

const isExpanded = $derived(forceExpanded || sidebar.expanded);
</script>

{#if !style.corporate}
<div class={cn('flex flex-col gap-1 px-2', className)}>
	<button
		type="button"
		style:height="var(--sidebar-item-size)"
		class={cn(
			'flex items-center whitespace-nowrap cursor-pointer border overflow-hidden transition-colors duration-fast motion-reduce:transition-none disabled:opacity-40 disabled:cursor-not-allowed',
			'focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
			isExpanded
				? 'gap-2 px-2 bg-transparent border-transparent rounded-md text-sm text-left w-full text-muted hover:bg-fg-alpha hover:text-fg'
				: 'justify-center border-transparent bg-transparent rounded-full opacity-60 hover:opacity-100 hover:bg-fg-alpha hover:text-fg rail-item'
		)}
		onclick={() => style.roll(toast)}
		disabled={style.rolling}
		aria-label={isExpanded ? undefined : 'Shuffle Style (Ctrl+Shift+R)'}
		title={isExpanded ? undefined : 'Shuffle Style'}
	>
		<span
			class={cn('i-lucide-dices text-icon-md shrink-0', style.rolling && 'animate-spin')}
		></span>
		{#if isExpanded}
			<span class="flex-1">Shuffle</span>
		{/if}
	</button>
</div>
{/if}
