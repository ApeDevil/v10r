<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { PaneGroup } from 'paneforge';
	import type { Snippet } from 'svelte';

	interface Props {
		direction?: 'horizontal' | 'vertical';
		autoSaveId?: string;
		onLayoutChange?: (layout: number[]) => void;
		children?: Snippet;
		class?: string;
	}

	let {
		direction = 'horizontal',
		autoSaveId,
		onLayoutChange,
		children,
		class: className
	}: Props = $props();
</script>

<PaneGroup
	{direction}
	{autoSaveId}
	{onLayoutChange}
	class={cn('flex overflow-hidden', direction === 'vertical' && 'flex-col', className)}
>
	{#if children}
		{@render children()}
	{/if}
</PaneGroup>
