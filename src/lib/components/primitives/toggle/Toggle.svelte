<script lang="ts">
import { Toggle as TogglePrimitive } from 'bits-ui';
import type { Snippet } from 'svelte';
import { cn } from '$lib/utils/cn';
import { type ToggleVariants, toggleVariants } from './toggle';

interface Props extends ToggleVariants {
	pressed?: boolean;
	disabled?: boolean;
	class?: string;
	children: Snippet;
}

let {
	pressed = $bindable(false),
	disabled = false,
	variant = 'default',
	size = 'md',
	class: className,
	children,
}: Props = $props();
</script>

<TogglePrimitive.Root bind:pressed {disabled}>
	{#snippet child({ props })}
		<button {...props} class={cn('toggle', toggleVariants({ variant, size }), className)}>
			{@render children()}
		</button>
	{/snippet}
</TogglePrimitive.Root>

<style>
	/* State-based styling — UnoCSS can't extract data-[state=*] from .ts files */
	.toggle {
		background: transparent;
		color: var(--color-fg);
	}

	.toggle:hover {
		background: var(--color-subtle);
	}

	.toggle:global([data-state='on']) {
		background: var(--color-primary-bg);
		color: var(--color-primary-fg);
	}

	.toggle:global([disabled]) {
		pointer-events: none;
		opacity: 0.5;
	}

	/* Outline variant border */
	.toggle:global(.border) {
		border: 1px solid var(--color-border);
	}

	/* Focus ring */
	.toggle:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-primary);
	}
</style>
