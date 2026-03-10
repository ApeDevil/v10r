<script lang="ts">
import { Dialog as DialogPrimitive } from 'bits-ui';
import type { Snippet } from 'svelte';
import { cn } from '$lib/utils/cn';

interface Props {
	open: boolean;
	title?: string;
	description?: string;
	children?: Snippet;
	class?: string;
}

let { open = $bindable(false), title, description, children, class: className }: Props = $props();
</script>

<DialogPrimitive.Root bind:open>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay
			class="fixed inset-0 z-overlay bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out"
		/>
		<DialogPrimitive.Content
			class={cn(
				'fixed left-1/2 top-1/2 z-modal -translate-x-1/2 -translate-y-1/2',
				'w-full max-w-md rounded-lg border border-border bg-surface-3 p-6 shadow-xl',
				'data-[state=open]:animate-in data-[state=closed]:animate-out',
				className
			)}
		>
			<div class="flex flex-col gap-4">
				{#if title}
					<DialogPrimitive.Title class="text-fluid-lg font-semibold text-fg">
						{title}
					</DialogPrimitive.Title>
				{/if}

				{#if description}
					<DialogPrimitive.Description class="text-fluid-sm text-muted">
						{description}
					</DialogPrimitive.Description>
				{/if}

				{#if children}
					{@render children()}
				{/if}
			</div>

			<DialogPrimitive.Close
				class="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
			>
				<span class="i-lucide-x h-4 w-4" ></span>
				<span class="sr-only">Close</span>
			</DialogPrimitive.Close>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
