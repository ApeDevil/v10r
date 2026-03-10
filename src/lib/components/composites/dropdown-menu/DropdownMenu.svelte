<script lang="ts">
import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
import type { Snippet } from 'svelte';
import { goto } from '$app/navigation';
import { cn } from '$lib/utils/cn';
import { dropdownMenuContentVariants, dropdownMenuItemVariants, dropdownMenuSeparatorVariants } from './dropdown-menu';

type DropdownItem =
	| {
			label: string;
			/** CSS icon class (e.g., 'i-lucide-home') */
			icon?: string;
			href?: string;
			onclick?: () => void;
			separator?: false;
			disabled?: boolean;
	  }
	| {
			separator: true;
			label?: never;
			icon?: never;
			href?: never;
			onclick?: never;
			disabled?: never;
	  };

interface TriggerProps {
	props: Record<string, unknown>;
}

interface Props {
	items: DropdownItem[];
	trigger: Snippet<[TriggerProps]>;
	align?: 'start' | 'center' | 'end';
}

let { items, trigger, align = 'end' }: Props = $props();
</script>

<DropdownMenuPrimitive.Root>
	<DropdownMenuPrimitive.Trigger class="focus-visible:outline-none">
		{#snippet child({ props })}
			{@render trigger({ props })}
		{/snippet}
	</DropdownMenuPrimitive.Trigger>

	<DropdownMenuPrimitive.Portal>
		<DropdownMenuPrimitive.Content
			class={dropdownMenuContentVariants()}
			sideOffset={4}
			{align}
		>
			{#each items as item}
				{#if item.separator}
					<DropdownMenuPrimitive.Separator class={dropdownMenuSeparatorVariants()} />
				{:else}
					<DropdownMenuPrimitive.Item
						disabled={item.disabled}
						class={dropdownMenuItemVariants()}
						onclick={() => {
							if (item.href) {
								goto(item.href);
							} else if (item.onclick) {
								item.onclick();
							}
						}}
					>
						{#if item.icon}
							<span class={cn(item.icon, 'h-4 w-4')} ></span>
						{/if}
						<span>{item.label}</span>
					</DropdownMenuPrimitive.Item>
				{/if}
			{/each}
		</DropdownMenuPrimitive.Content>
	</DropdownMenuPrimitive.Portal>
</DropdownMenuPrimitive.Root>

<style>
	/* UnoCSS can't extract data-[highlighted]:bg-muted/10 from .ts files (opacity modifier too complex) */
	:global([data-dropdown-menu-content] [role='menuitem'][data-highlighted]) {
		background-color: color-mix(in srgb, var(--color-muted) 10%, transparent);
	}
</style>
