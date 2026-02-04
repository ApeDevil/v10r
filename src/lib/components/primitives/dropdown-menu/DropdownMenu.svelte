<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils/cn';
	import type { Snippet } from 'svelte';

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
			class="z-dropdown min-w-[12rem] overflow-hidden rounded-md border border-border bg-surface-2 shadow-lg"
			sideOffset={4}
			{align}
		>
			{#each items as item}
				{#if item.separator}
					<DropdownMenuPrimitive.Separator class="h-px bg-border" />
				{:else}
					<DropdownMenuPrimitive.Item
						disabled={item.disabled}
						class={cn(
							'relative flex cursor-pointer select-none items-center gap-3 px-3 py-2',
							'text-fluid-sm text-fg outline-none',
							'data-[highlighted]:bg-muted/10',
							'data-[disabled]:pointer-events-none data-[disabled]:opacity-50'
						)}
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
