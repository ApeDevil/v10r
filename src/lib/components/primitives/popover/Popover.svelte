<script lang="ts">
	import { Popover as PopoverPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils/cn';
	import type { Snippet } from 'svelte';

	interface Props {
		trigger: Snippet;
		content: Snippet;
		open?: boolean;
		side?: 'top' | 'right' | 'bottom' | 'left';
		align?: 'start' | 'center' | 'end';
		class?: string;
	}

	let {
		trigger,
		content,
		open = $bindable(false),
		side = 'bottom',
		align = 'center',
		class: className
	}: Props = $props();
</script>

<PopoverPrimitive.Root bind:open>
	<PopoverPrimitive.Trigger>
		{@render trigger()}
	</PopoverPrimitive.Trigger>

	<PopoverPrimitive.Portal>
		<PopoverPrimitive.Content
			{side}
			{align}
			sideOffset={4}
			class={cn(
				'z-popover w-72 rounded-md border border-border bg-bg p-4 text-fg shadow-md outline-none',
				'data-[state=open]:animate-in data-[state=closed]:animate-out',
				'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
				'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
				'data-[side=bottom]:slide-in-from-top-2',
				'data-[side=left]:slide-in-from-right-2',
				'data-[side=right]:slide-in-from-left-2',
				'data-[side=top]:slide-in-from-bottom-2',
				className
			)}
		>
			{@render content()}
		</PopoverPrimitive.Content>
	</PopoverPrimitive.Portal>
</PopoverPrimitive.Root>
