<script lang="ts">
import { Popover as PopoverPrimitive } from 'bits-ui';
import type { Snippet } from 'svelte';
import { cn } from '$lib/utils/cn';

interface Props {
	trigger: Snippet;
	content: Snippet;
	open?: boolean;
	side?: 'top' | 'right' | 'bottom' | 'left';
	align?: 'start' | 'center' | 'end';
	/** Set when the popover opens inside a modal: lifts it above the modal's z
	 * (data-modal-float wrapper rule) and bumps appearance to E4. */
	inModal?: boolean;
	class?: string;
}

let {
	trigger,
	content,
	open = $bindable(false),
	side = 'bottom',
	align = 'center',
	inModal = false,
	class: className,
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
			collisionPadding={8}
			data-elevation={inModal ? '4' : '2'}
			data-modal-float={inModal ? '' : undefined}
			class={cn(
				'z-popover w-72 max-w-[calc(100vw-1rem)] max-h-[var(--bits-popover-content-available-height,80vh)] overflow-y-auto rounded-md border p-4 text-fg outline-none',
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
