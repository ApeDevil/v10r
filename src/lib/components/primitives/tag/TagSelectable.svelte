<script lang="ts">
	import { Toggle as TogglePrimitive } from 'bits-ui';
	import { cn } from '$lib/utils/cn';
	import { tagSelectableVariants, type TagSelectableVariants } from './tag';

	interface Props extends TagSelectableVariants {
		label: string;
		pressed?: boolean;
		icon?: string;
		disabled?: boolean;
		class?: string;
	}

	let {
		label,
		pressed = $bindable(false),
		icon,
		variant = 'default',
		size = 'md',
		disabled = false,
		class: className
	}: Props = $props();
</script>

<TogglePrimitive.Root bind:pressed {disabled}>
	{#snippet child({ props })}
		<button
			{...props}
			class={cn('tag-selectable', tagSelectableVariants({ variant, size }), className)}
		>
			{#if pressed}
				<span class="i-lucide-check check-icon" aria-hidden="true"></span>
			{:else if icon}
				<span class={cn('tag-icon', icon)} aria-hidden="true"></span>
			{/if}

			{label}
		</button>
	{/snippet}
</TogglePrimitive.Root>

<style>
	.tag-selectable {
		line-height: 1;
		transition: background-color 150ms, color 150ms;
	}

	/* Default variant states */
	.tag-selectable:global(.bg-muted) {
		background-color: color-mix(in srgb, var(--color-muted) 15%, transparent);
		color: var(--color-fg);
	}

	.tag-selectable:global(.bg-muted):hover {
		background-color: color-mix(in srgb, var(--color-muted) 25%, transparent);
	}

	.tag-selectable:global(.bg-muted):global([data-state='on']) {
		background-color: var(--color-primary);
		color: var(--color-primary-fg);
	}

	/* Outline variant states */
	.tag-selectable:global(.border):global([data-state='on']) {
		background-color: var(--color-primary);
		color: var(--color-primary-fg);
		border-color: var(--color-primary);
	}

	.tag-selectable:global(.border):hover {
		background-color: color-mix(in srgb, var(--color-muted) 10%, transparent);
	}

	/* Disabled state */
	.tag-selectable:global([disabled]) {
		pointer-events: none;
		opacity: 0.5;
	}

	/* Focus ring */
	.tag-selectable:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-primary);
	}

	.check-icon {
		width: 0.75rem;
		height: 0.75rem;
		flex-shrink: 0;
	}

	.tag-icon {
		flex-shrink: 0;
		width: 1em;
		height: 1em;
	}
</style>
