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
		'flex h-11 w-full rounded-t-md px-4 py-2',
		'text-fluid-base text-fg placeholder:text-muted',
		'focus-visible:outline-none',
		'disabled:cursor-not-allowed disabled:opacity-50',
		error && 'input-error',
		className
	)}
	{...restProps}
	aria-invalid={error ? 'true' : undefined}
/>

<style>
	input {
		background-color: var(--color-input);
		border: none;
		border-bottom: 1px solid var(--color-input-border);
		transition: border-bottom-color 150ms ease, border-bottom-width 150ms ease;
	}

	input:focus-visible {
		border-bottom: 2px solid var(--color-primary);
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
		border-radius: 6px;
	}

	input.input-error {
		border-bottom-color: var(--color-error);
	}
</style>
