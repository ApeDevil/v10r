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
		'flex h-10 w-full rounded-md border bg-bg px-3 py-2',
		'text-fluid-base text-fg placeholder:text-muted',
		'transition-colors duration-fast',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
		'disabled:cursor-not-allowed disabled:opacity-50',
		error ? 'border-error' : 'border-border',
		className
	)}
	aria-invalid={error ? 'true' : undefined}
	{...restProps}
/>
