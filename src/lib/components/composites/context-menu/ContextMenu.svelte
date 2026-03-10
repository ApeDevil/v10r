<script lang="ts">
import { ContextMenu as ContextMenuPrimitive } from 'bits-ui';
import type { Snippet } from 'svelte';
import { cn } from '$lib/utils/cn';
import {
	contextMenuContentVariants,
	contextMenuItemVariants,
	contextMenuSeparatorVariants,
	contextMenuShortcutVariants,
} from './context-menu';
import type { ContextMenuItem } from './types';

interface TriggerProps {
	props: Record<string, unknown>;
}

interface Props {
	items: ContextMenuItem[];
	trigger: Snippet<[TriggerProps]>;
	align?: 'start' | 'center' | 'end';
}

let { items, trigger, align = 'start' }: Props = $props();
</script>

<ContextMenuPrimitive.Root>
	<ContextMenuPrimitive.Trigger class="focus-visible:outline-none">
		{#snippet child({ props })}
			{@render trigger({ props })}
		{/snippet}
	</ContextMenuPrimitive.Trigger>

	<ContextMenuPrimitive.Portal>
		<ContextMenuPrimitive.Content
			class={contextMenuContentVariants()}
		>
			{#each items as item}
				{#if item.separator}
					<ContextMenuPrimitive.Separator class={contextMenuSeparatorVariants()} />
				{:else}
					<ContextMenuPrimitive.Item
						disabled={item.disabled}
						class={contextMenuItemVariants()}
						onclick={() => {
							if (item.onclick) {
								item.onclick();
							}
						}}
					>
						{#if item.icon}
							<span class={cn(item.icon, 'h-4 w-4')} ></span>
						{/if}
						<span class="flex-1">{item.label}</span>
						{#if item.shortcut}
							<span class={contextMenuShortcutVariants()}>{item.shortcut}</span>
						{/if}
					</ContextMenuPrimitive.Item>
				{/if}
			{/each}
		</ContextMenuPrimitive.Content>
	</ContextMenuPrimitive.Portal>
</ContextMenuPrimitive.Root>

<style>
	/* UnoCSS can't extract data-[highlighted]:bg-muted/10 from .ts files (opacity modifier too complex) */
	:global([data-context-menu-content] [role='menuitem'][data-highlighted]) {
		background-color: color-mix(in srgb, var(--color-muted) 10%, transparent);
	}
</style>
