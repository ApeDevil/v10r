<script lang="ts">
	import type { HTMLSelectAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';

	interface Option {
		value: string;
		label: string;
		disabled?: boolean;
	}

	interface Props extends Omit<HTMLSelectAttributes, 'value'> {
		options: Option[];
		value?: string;
		placeholder?: string;
		class?: string;
	}

	let {
		options,
		value = $bindable(''),
		placeholder = 'Select...',
		class: className,
		...restProps
	}: Props = $props();
</script>

<select
	bind:value
	class={cn(
		'flex h-10 w-full items-center justify-between rounded-md border border-border bg-bg px-3 py-2',
		'text-fluid-base text-fg',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
		'disabled:cursor-not-allowed disabled:opacity-50',
		className
	)}
	{...restProps}
>
	{#if placeholder}
		<option value="" disabled selected={!value}>{placeholder}</option>
	{/if}
	{#each options as option}
		<option value={option.value} disabled={option.disabled}>
			{option.label}
		</option>
	{/each}
</select>
