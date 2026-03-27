<script lang="ts">
import type { HTMLTextareaAttributes } from 'svelte/elements';
import { cn } from '$lib/utils/cn';

interface Props extends Omit<HTMLTextareaAttributes, 'value'> {
	value?: string;
	error?: boolean;
	class?: string;
}

let { value = $bindable(''), error = false, class: className, ...restProps }: Props = $props();
</script>

<textarea
	bind:value
	class={cn(
		'flex min-h-[5.5rem] w-full rounded-t-md px-4 py-2',
		'text-fluid-base text-fg placeholder:text-muted',
		'focus-visible:outline-none',
		'disabled:cursor-not-allowed disabled:opacity-50',
		error && 'textarea-error',
		className
	)}
	{...restProps}
	aria-invalid={error ? 'true' : undefined}
></textarea>

<style>
	textarea {
		background-color: var(--color-input);
		border: none;
		border-bottom: 1px solid var(--color-input-border);
		transition: border-bottom-color 150ms ease, border-bottom-width 150ms ease;
		resize: vertical;
		font-family: inherit;
	}

	textarea:focus-visible {
		border-bottom: 2px solid var(--color-primary);
	}

	textarea.textarea-error {
		border-bottom-color: var(--color-error);
	}
</style>
