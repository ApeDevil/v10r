<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils/cn';
	import type { Snippet } from 'svelte';
	import {
		dropdownMenuContentVariants,
		dropdownMenuItemVariants,
		dropdownMenuSeparatorVariants
	} from './dropdown-menu';

	interface DropdownItem {
		label: string;
		/** CSS icon class (e.g., 'i-lucide-home') */
		icon?: string;
		href?: string;
		onclick?: () => void;
		separator?: boolean;
		disabled?: boolean;
	}

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
								window.location.href = item.href;
							} else if (item.onclick) {
								item.onclick();
							}
						}}
					>
						{#if item.icon}
							<span class={cn(item.icon, 'h-4 w-4')} />
						{/if}
						<span>{item.label}</span>
					</DropdownMenuPrimitive.Item>
				{/if}
			{/each}
		</DropdownMenuPrimitive.Content>
	</DropdownMenuPrimitive.Portal>
</DropdownMenuPrimitive.Root>
