<script lang="ts">
import { ToggleGroup as ToggleGroupPrimitive } from 'bits-ui';
import { cn } from '$lib/utils/cn';
import {
	type ToggleGroupItemVariants,
	type ToggleGroupVariants,
	toggleGroupItemVariants,
	toggleGroupVariants,
} from './toggle-group';

interface ToggleGroupItem {
	value: string;
	label?: string;
	icon?: string;
	disabled?: boolean;
}

interface Props extends ToggleGroupVariants, ToggleGroupItemVariants {
	type?: 'single' | 'multiple';
	value?: string | string[];
	items: ToggleGroupItem[];
	disabled?: boolean;
	class?: string;
}

let {
	type = 'single',
	value = $bindable(),
	items,
	variant = 'default',
	size = 'md',
	orientation = 'horizontal',
	disabled = false,
	class: className,
}: Props = $props();

// Default value depends on type — can't reference type in $bindable() default
if (value === undefined) {
	value = type === 'single' ? '' : [];
}

// Determine border radius classes based on position and orientation
function getItemClasses(index: number, isHorizontal: boolean) {
	const isFirst = index === 0;
	const isLast = index === items.length - 1;

	if (isHorizontal) {
		if (isFirst && isLast) return 'rounded-md';
		if (isFirst) return 'rounded-l-md border-r-0';
		if (isLast) return 'rounded-r-md';
		return 'border-r-0';
	} else {
		if (isFirst && isLast) return 'rounded-md';
		if (isFirst) return 'rounded-t-md border-b-0';
		if (isLast) return 'rounded-b-md';
		return 'border-b-0';
	}
}

const isHorizontal = $derived(orientation === 'horizontal');
</script>

{#if type === 'single'}
	<ToggleGroupPrimitive.Root value={value as string} onValueChange={(v: string) => value = v} {disabled} type="single">
		{#snippet child({ props })}
			<div
				{...props}
				class={cn('toggle-group', toggleGroupVariants({ orientation }), className)}
			>
				{#each items as item, index}
					<ToggleGroupPrimitive.Item value={item.value} disabled={item.disabled || disabled}>
						{#snippet child({ props: itemProps })}
							<button
								{...itemProps}
								class={cn(
									'toggle-group-item',
									toggleGroupItemVariants({ variant, size }),
									getItemClasses(index, isHorizontal)
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
{:else}
	<ToggleGroupPrimitive.Root value={value as string[]} onValueChange={(v: string[]) => value = v} {disabled} type="multiple">
		{#snippet child({ props })}
			<div
				{...props}
				class={cn('toggle-group', toggleGroupVariants({ orientation }), className)}
			>
				{#each items as item, index}
					<ToggleGroupPrimitive.Item value={item.value} disabled={item.disabled || disabled}>
						{#snippet child({ props: itemProps })}
							<button
								{...itemProps}
								class={cn(
									'toggle-group-item',
									toggleGroupItemVariants({ variant, size }),
									getItemClasses(index, isHorizontal)
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
{/if}

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
		background: var(--color-primary-bg);
		color: var(--color-primary-fg);
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
