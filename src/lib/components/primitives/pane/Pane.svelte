<script lang="ts">
import { Pane } from 'paneforge';
import type { Snippet } from 'svelte';
import { cn } from '$lib/utils/cn';

interface Props {
	defaultSize?: number;
	minSize?: number;
	maxSize?: number;
	collapsible?: boolean;
	collapsedSize?: number;
	onCollapse?: () => void;
	onExpand?: () => void;
	onResize?: (size: number, prevSize: number | undefined) => void;
	children?: Snippet;
	class?: string;
}

let {
	defaultSize,
	minSize,
	maxSize,
	collapsible,
	collapsedSize,
	onCollapse,
	onExpand,
	onResize,
	children,
	class: className,
}: Props = $props();
</script>

<Pane
	{defaultSize}
	{minSize}
	{maxSize}
	{collapsible}
	{collapsedSize}
	{onCollapse}
	{onExpand}
	{onResize}
	class={cn('overflow-auto min-w-0 min-h-0', className)}
>
	{#if children}
		{@render children()}
	{/if}
</Pane>
