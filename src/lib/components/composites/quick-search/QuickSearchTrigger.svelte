<script lang="ts">
	import Icon from '@iconify/svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		collapsed?: boolean;
		onclick: () => void;
	}

	let { collapsed = false, onclick }: Props = $props();
</script>

{#if collapsed}
	<!-- Rail mode: icon only -->
	<button
		class="flex h-10 w-10 items-center justify-center rounded-md text-muted hover:bg-muted/10 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
		{onclick}
		aria-label="Open search"
	>
		<Icon icon="lucide:search" class="h-5 w-5" />
	</button>
{:else}
	<!-- Expanded mode: fake input -->
	<button
		class={cn(
			'flex h-9 w-full items-center gap-2 rounded-md border border-border bg-bg/50 px-3',
			'text-muted hover:border-muted hover:text-fg',
			'transition-colors duration-fast',
			'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
		)}
		{onclick}
	>
		<Icon icon="lucide:search" class="h-4 w-4" />
		<span class="flex-1 text-left text-sm">Search...</span>
		<kbd class="rounded bg-muted/20 px-1.5 py-0.5 text-xs">⌘K</kbd>
	</button>
{/if}
