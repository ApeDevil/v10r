<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';
	import { chipVariants, chipCloseVariants, type ChipVariants } from './chip';

	interface Props extends ChipVariants {
		label?: string;
		icon?: string;
		disabled?: boolean;
		ondismiss?: () => void;
		class?: string;
		children?: Snippet;
	}

	let {
		label,
		icon,
		variant = 'default',
		size = 'md',
		disabled = false,
		ondismiss,
		class: className,
		children
	}: Props = $props();
</script>

<span
	class={cn('chip', chipVariants({ variant, size }), className)}
	class:disabled
	role="group"
	aria-label={label}
>
	{#if icon}
		<span class={cn('chip-icon', icon)} aria-hidden="true"></span>
	{/if}

	<span class="chip-label">
		{#if children}
			{@render children()}
		{:else if label}
			{label}
		{/if}
	</span>

	{#if ondismiss}
		<button
			type="button"
			class={cn('chip-close', chipCloseVariants())}
			aria-label={label ? `Remove ${label}` : 'Remove'}
			{disabled}
			onclick={ondismiss}
		>
			<span class="i-lucide-x close-icon" aria-hidden="true"></span>
		</button>
	{/if}
</span>

<style>
	.chip {
		line-height: 1;
	}

	.chip.disabled {
		pointer-events: none;
		opacity: 0.5;
	}

	.chip-label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.chip-icon {
		flex-shrink: 0;
		width: 1em;
		height: 1em;
	}

	.chip-close {
		flex-shrink: 0;
		width: 1em;
		height: 1em;
		background: none;
		color: inherit;
		opacity: 0.6;
		transition: opacity 150ms;
	}

	.chip-close:hover {
		opacity: 1;
	}

	.close-icon {
		width: 100%;
		height: 100%;
	}

	/* Variant backgrounds via color-mix — UnoCSS opacity modifiers broken with CSS vars */
	.chip:global(.bg-primary) {
		background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
		color: var(--color-primary);
	}

	.chip:global(.bg-muted) {
		background-color: color-mix(in srgb, var(--color-muted) 20%, transparent);
	}

	.chip:global(.bg-success) {
		background-color: color-mix(in srgb, var(--color-success) 12%, transparent);
		color: var(--color-success);
	}

	.chip:global(.bg-warning) {
		background-color: color-mix(in srgb, var(--color-warning) 12%, transparent);
		color: var(--color-warning);
	}

	.chip:global(.bg-error) {
		background-color: color-mix(in srgb, var(--color-error) 12%, transparent);
		color: var(--color-error);
	}

	:global(.dark) .chip:global(.bg-error) {
		background-color: var(--color-error-light);
		color: var(--color-error-fg);
	}
</style>
