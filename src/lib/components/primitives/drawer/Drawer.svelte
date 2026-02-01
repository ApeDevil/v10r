<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import Icon from '@iconify/svelte';
	import { cn } from '$lib/utils/cn';
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		side?: 'left' | 'right' | 'bottom';
		children?: Snippet;
		class?: string;
	}

	let { open = $bindable(false), side = 'right', children, class: className }: Props = $props();

	const sideClasses = {
		left: 'inset-y-0 left-0 h-full w-3/4 max-w-sm data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left',
		right:
			'inset-y-0 right-0 h-full w-3/4 max-w-sm data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
		bottom:
			'inset-x-0 bottom-0 h-auto max-h-[80vh] data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom'
	};
</script>

<DialogPrimitive.Root bind:open>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay
			class="fixed inset-0 z-overlay bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out"
		/>
		<DialogPrimitive.Content
			class={cn(
				'fixed z-modal border border-border bg-bg shadow-xl',
				'data-[state=open]:animate-in data-[state=closed]:animate-out',
				sideClasses[side],
				className
			)}
		>
			<div class="flex h-full flex-col">
				<div class="flex items-center justify-between border-b border-border px-4 py-3">
					<DialogPrimitive.Title class="text-fluid-lg font-semibold text-fg">
						Menu
					</DialogPrimitive.Title>
					<DialogPrimitive.Close
						class="rounded-sm opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
					>
						<Icon icon="lucide:x" class="h-4 w-4" />
						<span class="sr-only">Close</span>
					</DialogPrimitive.Close>
				</div>

				{#if children}
					<div class="flex-1 overflow-y-auto p-4">
						{@render children()}
					</div>
				{/if}
			</div>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
