<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';

	interface Props extends Omit<HTMLInputAttributes, 'value'> {
		value?: string;
		error?: boolean;
		class?: string;
	}

	let { value = $bindable(''), error = false, class: className, ...restProps }: Props = $props();
</script>

<input
	bind:value
	class={cn(
		'flex h-11 w-full rounded-md border px-4 py-2',
		'text-fluid-base text-fg placeholder:text-muted',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
		'disabled:cursor-not-allowed disabled:opacity-50',
		error ? 'border-error' : 'border-input-border',
		className
	)}
	aria-invalid={error ? 'true' : undefined}
	{...restProps}
/>

<style>
	input {
		background-color: var(--color-input-bg);
		--un-ring-offset-color: transparent;
	}
</style>
