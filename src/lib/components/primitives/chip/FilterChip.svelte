<script lang="ts">
	import { Toggle as TogglePrimitive } from 'bits-ui';
	import { cn } from '$lib/utils/cn';
	import { filterChipVariants, type FilterChipVariants } from './chip';

	interface Props extends FilterChipVariants {
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
			class={cn('filter-chip', filterChipVariants({ variant, size }), className)}
		>
			{#if pressed}
				<span class="i-lucide-check check-icon" aria-hidden="true"></span>
			{:else if icon}
				<span class={cn('chip-icon', icon)} aria-hidden="true"></span>
			{/if}

			{label}
		</button>
	{/snippet}
</TogglePrimitive.Root>

<style>
	.filter-chip {
		line-height: 1;
		transition: background-color 150ms, color 150ms;
	}

	/* Default variant states */
	.filter-chip:global(.bg-muted) {
		background-color: color-mix(in srgb, var(--color-muted) 15%, transparent);
		color: var(--color-fg);
	}

	.filter-chip:global(.bg-muted):hover {
		background-color: color-mix(in srgb, var(--color-muted) 25%, transparent);
	}

	.filter-chip:global(.bg-muted):global([data-state='on']) {
		background-color: var(--color-primary);
		color: var(--color-primary-fg);
	}

	/* Outline variant states */
	.filter-chip:global(.border):global([data-state='on']) {
		background-color: var(--color-primary);
		color: var(--color-primary-fg);
		border-color: var(--color-primary);
	}

	.filter-chip:global(.border):hover {
		background-color: color-mix(in srgb, var(--color-muted) 10%, transparent);
	}

	/* Disabled state */
	.filter-chip:global([disabled]) {
		pointer-events: none;
		opacity: 0.5;
	}

	/* Focus ring */
	.filter-chip:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-primary);
	}

	.check-icon {
		width: 0.75rem;
		height: 0.75rem;
		flex-shrink: 0;
	}

	.chip-icon {
		flex-shrink: 0;
	}
</style>
