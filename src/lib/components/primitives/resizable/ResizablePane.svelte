<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { resizablePaneVariants, type ResizableContext } from './resizable';
	import { getContext } from 'svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		defaultSize?: number;
		minSize?: number;
		maxSize?: number;
		collapsible?: boolean;
		children?: Snippet;
		class?: string;
	}

	let {
		defaultSize = 50,
		minSize = 10,
		maxSize = 90,
		collapsible = false,
		children,
		class: className
	}: Props = $props();

	const ctx = getContext<ResizableContext>('resizable');
	const paneIndex = ctx.registerPane(defaultSize, collapsible ? 0 : minSize, maxSize);

	let size = $derived(ctx.sizes[paneIndex]);
</script>

<div
	style="flex: {size} 1 0%; overflow: auto;"
	class={cn(resizablePaneVariants(), className)}
>
	{#if children}
		{@render children()}
	{/if}
</div>
