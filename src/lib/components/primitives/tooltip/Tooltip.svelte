<script lang="ts">
import { Tooltip as TooltipPrimitive } from 'bits-ui';
import type { Snippet } from 'svelte';
import { cn } from '$lib/utils/cn';

interface Props {
	children: Snippet;
	content: string | Snippet;
	side?: 'top' | 'right' | 'bottom' | 'left';
	delayDuration?: number;
	class?: string;
}

let { children, content, side = 'top', delayDuration = 200, class: className }: Props = $props();

// Type guard to check if content is a string
const isString = (val: string | Snippet): val is string => typeof val === 'string';
</script>

<TooltipPrimitive.Root {delayDuration}>
	<TooltipPrimitive.Trigger class="bg-transparent border-none p-0 m-0 cursor-pointer">
		{@render children()}
	</TooltipPrimitive.Trigger>

	<TooltipPrimitive.Portal>
		<TooltipPrimitive.Content
			{side}
			sideOffset={4}
			class={cn(
				'z-tooltip overflow-hidden rounded-md bg-surface-3 px-3 py-1.5 text-fluid-xs text-fg',
				'animate-in fade-in-0 zoom-in-95',
				'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
				'data-[side=bottom]:slide-in-from-top-2',
				'data-[side=left]:slide-in-from-right-2',
				'data-[side=right]:slide-in-from-left-2',
				'data-[side=top]:slide-in-from-bottom-2',
				className
			)}
		>
			{#if isString(content)}
				{content}
			{:else}
				{@render content()}
			{/if}
		</TooltipPrimitive.Content>
	</TooltipPrimitive.Portal>
</TooltipPrimitive.Root>
