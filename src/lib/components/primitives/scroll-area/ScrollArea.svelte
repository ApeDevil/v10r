<script lang="ts">
	import { ScrollArea as ScrollAreaPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils/cn';
	import {
		scrollAreaVariants,
		scrollbarVariants,
		scrollThumbVariants,
		type ScrollbarVariants
	} from './scroll-area';
	import type { Snippet } from 'svelte';

	interface Props {
		/**
		 * The type of scroll area behavior
		 * - 'auto': Scrollbars appear on hover/scroll, hide after delay
		 * - 'always': Scrollbars always visible
		 * - 'scroll': Scrollbars appear during scroll only
		 * - 'hover': Scrollbars appear on hover only
		 */
		type?: 'auto' | 'always' | 'scroll' | 'hover';
		/**
		 * Which scrollbar(s) to show
		 */
		orientation?: 'vertical' | 'horizontal' | 'both';
		/**
		 * Scrollbar size variant
		 */
		size?: ScrollbarVariants['size'];
		/**
		 * Time in milliseconds before scrollbars hide
		 */
		scrollHideDelay?: number;
		/**
		 * Additional CSS classes for the root container
		 */
		class?: string;
		/**
		 * Content to render inside the scroll area
		 */
		children?: Snippet;
	}

	let {
		type = 'hover',
		orientation = 'vertical',
		size = 'md',
		scrollHideDelay = 600,
		class: className,
		children
	}: Props = $props();

	const showVertical = $derived(orientation === 'vertical' || orientation === 'both');
	const showHorizontal = $derived(orientation === 'horizontal' || orientation === 'both');
</script>

<ScrollAreaPrimitive.Root {type} {scrollHideDelay} class={cn(scrollAreaVariants(), className)}>
	<ScrollAreaPrimitive.Viewport class="h-full w-full rounded-[inherit]">
		{#if children}
			{@render children()}
		{/if}
	</ScrollAreaPrimitive.Viewport>

	{#if showVertical}
		<ScrollAreaPrimitive.Scrollbar
			orientation="vertical"
			class={cn(scrollbarVariants({ orientation: 'vertical', size }))}
		>
			<ScrollAreaPrimitive.Thumb class={cn(scrollThumbVariants())} />
		</ScrollAreaPrimitive.Scrollbar>
	{/if}

	{#if showHorizontal}
		<ScrollAreaPrimitive.Scrollbar
			orientation="horizontal"
			class={cn(scrollbarVariants({ orientation: 'horizontal', size }))}
		>
			<ScrollAreaPrimitive.Thumb class={cn(scrollThumbVariants())} />
		</ScrollAreaPrimitive.Scrollbar>
	{/if}

	{#if showVertical && showHorizontal}
		<ScrollAreaPrimitive.Corner />
	{/if}
</ScrollAreaPrimitive.Root>
