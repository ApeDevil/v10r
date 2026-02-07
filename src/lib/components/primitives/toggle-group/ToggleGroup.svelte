<script lang="ts">
	import { ToggleGroup as ToggleGroupPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils/cn';
	import {
		toggleGroupVariants,
		toggleGroupItemVariants,
		type ToggleGroupVariants,
		type ToggleGroupItemVariants
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
		class: className
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
	<ToggleGroupPrimitive.Root
		bind:value
		{disabled}
		type="single"
		class={cn(toggleGroupVariants({ orientation }), className)}
	>
		{#each items as item, index}
			<ToggleGroupPrimitive.Item
				value={item.value}
				disabled={item.disabled || disabled}
				class={cn(
					toggleGroupItemVariants({ variant, size }),
					getItemClasses(index, isHorizontal)
				)}
			>
				{#if item.icon}
					<span class="mr-2">{item.icon}</span>
				{/if}
				{item.label || item.value}
			</ToggleGroupPrimitive.Item>
		{/each}
	</ToggleGroupPrimitive.Root>
{:else}
	<ToggleGroupPrimitive.Root
		bind:value
		{disabled}
		type="multiple"
		class={cn(toggleGroupVariants({ orientation }), className)}
	>
		{#each items as item, index}
			<ToggleGroupPrimitive.Item
				value={item.value}
				disabled={item.disabled || disabled}
				class={cn(
					toggleGroupItemVariants({ variant, size }),
					getItemClasses(index, isHorizontal)
				)}
			>
				{#if item.icon}
					<span class="mr-2">{item.icon}</span>
				{/if}
				{item.label || item.value}
			</ToggleGroupPrimitive.Item>
		{/each}
	</ToggleGroupPrimitive.Root>
{/if}
