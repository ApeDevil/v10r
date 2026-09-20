<script lang="ts">
import { ToggleGroup as ToggleGroupPrimitive } from 'bits-ui';
import { cn } from '$lib/utils/cn';
import { type ToggleGroupItemVariants, toggleGroupItemVariants, toggleGroupVariants } from './toggle-group';

interface ToggleGroupItem {
	value: string;
	label?: string;
	icon?: string;
	disabled?: boolean;
}

interface Props extends ToggleGroupItemVariants {
	value?: string;
	items: ToggleGroupItem[];
	disabled?: boolean;
	class?: string;
}

let { value = $bindable(''), items, size = 'md', disabled = false, class: className }: Props = $props();

// Border radius by position: the first and last items close the pill.
function getItemClasses(index: number) {
	const isFirst = index === 0;
	const isLast = index === items.length - 1;
	if (isFirst && isLast) return 'rounded-md';
	if (isFirst) return 'rounded-l-md border-r-0';
	if (isLast) return 'rounded-r-md';
	return 'border-r-0';
}
</script>

<ToggleGroupPrimitive.Root value={value} onValueChange={(v: string) => value = v} {disabled} type="single">
	{#snippet child({ props })}
		<div
			{...props}
			class={cn('toggle-group', toggleGroupVariants(), className)}
		>
			{#each items as item, index}
				<ToggleGroupPrimitive.Item value={item.value} disabled={item.disabled || disabled}>
					{#snippet child({ props: itemProps })}
						<button
							{...itemProps}
							class={cn(
								'toggle-group-item',
								toggleGroupItemVariants({ size }),
								getItemClasses(index)
							)}
						>
							{#if item.icon}
								<span class="mr-2">{item.icon}</span>
							{/if}
							{item.label || item.value}
						</button>
					{/snippet}
				</ToggleGroupPrimitive.Item>
			{/each}
		</div>
	{/snippet}
</ToggleGroupPrimitive.Root>

<style>
	/* State-based styling — UnoCSS can't extract data-[state=*] from .ts files */
	.toggle-group-item {
		background: transparent;
		color: var(--color-fg);
		border: 1px solid var(--color-border);
	}

	.toggle-group-item:hover {
		background: var(--color-subtle);
	}

	.toggle-group-item:global([data-state='on']) {
		background: var(--color-primary-container);
		color: var(--color-on-primary-container);
	}

	.toggle-group-item:global([disabled]) {
		pointer-events: none;
		opacity: 0.5;
	}

	/* Focus ring */
	.toggle-group-item:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-primary);
	}
</style>
