<script lang="ts">
/**
 * Theme toggle for unauthenticated users.
 * Cycles through light → dark.
 * Dual-mode: icon-only in rail, labeled when expanded.
 */

import { getSidebar } from '$lib/state/sidebar.svelte';
import { getTheme } from '$lib/state/theme.svelte';
import { cn } from '$lib/utils/cn';

interface Props {
	forceExpanded?: boolean;
	class?: string;
}

let { forceExpanded = false, class: className }: Props = $props();

const sidebar = getSidebar();
const theme = getTheme();

const isExpanded = $derived(forceExpanded || sidebar.expanded);

type ToggleMode = 'light' | 'dark';

const icons: Record<ToggleMode, string> = {
	light: 'i-lucide-sun',
	dark: 'i-lucide-moon',
};
const labels: Record<ToggleMode, string> = {
	light: 'Light',
	dark: 'Dark',
};

/** Display mode: resolve 'system' to the actual light/dark value */
const displayMode: ToggleMode = $derived(theme.resolvedMode === 'dark' ? 'dark' : 'light');

function cycle(e: MouseEvent) {
	e.stopPropagation();
	theme.setMode(displayMode === 'light' ? 'dark' : 'light');
}
</script>

<div class={cn('flex flex-col gap-1 px-2', className)}>
	<button
		type="button"
		style:height="var(--sidebar-item-size)"
		class={cn(
			'flex items-center whitespace-nowrap cursor-pointer border overflow-hidden transition-colors duration-fast motion-reduce:transition-none',
			'focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
			isExpanded
				? 'gap-2 px-2 bg-transparent border-transparent rounded-md text-sm text-left w-full text-muted hover:bg-fg-alpha hover:text-fg'
				: 'justify-center border-transparent bg-transparent rounded-full opacity-60 hover:opacity-100 hover:bg-fg-alpha hover:text-fg rail-item'
		)}
		onclick={cycle}
		aria-label={isExpanded ? undefined : `Theme: ${labels[displayMode]}`}
		title={isExpanded ? undefined : `Theme: ${labels[displayMode]}`}
	>
		<span class={cn(icons[displayMode], 'text-icon-md shrink-0')}></span>
		{#if isExpanded}
			<span class="flex-1">{labels[displayMode]}</span>
		{/if}
	</button>
</div>
