<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';
	import { tagVariants, tagCloseVariants, type TagVariants } from './tag';

	interface Props extends TagVariants, HTMLAttributes<HTMLSpanElement> {
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
		children,
		...rest
	}: Props = $props();
</script>

<span
	class={cn('tag', tagVariants({ variant, size }), className)}
	class:disabled
	role={ondismiss ? 'group' : undefined}
	aria-label={label}
	{...rest}
>
	{#if icon}
		<span class={cn('tag-icon', icon)} aria-hidden="true"></span>
	{/if}

	<span class="tag-label">
		{#if children}
			{@render children()}
		{:else if label}
			{label}
		{/if}
	</span>

	{#if ondismiss}
		<button
			type="button"
			class={cn('tag-close', tagCloseVariants())}
			aria-label={label ? `Remove ${label}` : 'Remove'}
			{disabled}
			onclick={ondismiss}
		>
			<span class="i-lucide-x close-icon" aria-hidden="true"></span>
		</button>
	{/if}
</span>

<style>
	.tag {
		line-height: 1;
	}

	.tag.disabled {
		pointer-events: none;
		opacity: 0.5;
	}

	.tag-label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tag-icon {
		flex-shrink: 0;
		width: 1em;
		height: 1em;
	}

	.tag-close {
		flex-shrink: 0;
		min-width: 24px;
		min-height: 24px;
		width: 1.25em;
		height: 1.25em;
		background: none;
		color: inherit;
		opacity: 0.6;
		transition: opacity 150ms;
	}

	.tag-close:hover {
		opacity: 1;
	}

	.close-icon {
		width: 0.75em;
		height: 0.75em;
	}

	/* Variant backgrounds via color-mix — UnoCSS opacity modifiers broken with CSS vars */
	.tag:global(.bg-primary) {
		background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
		color: var(--color-primary);
	}

	.tag:global(.bg-muted) {
		background-color: color-mix(in srgb, var(--color-muted) 20%, transparent);
	}

	.tag:global(.bg-success) {
		background-color: color-mix(in srgb, var(--color-success) 12%, transparent);
		color: var(--color-success);
	}

	.tag:global(.bg-warning) {
		background-color: color-mix(in srgb, var(--color-warning) 12%, transparent);
		color: var(--color-warning);
	}

	.tag:global(.bg-error) {
		background-color: color-mix(in srgb, var(--color-error) 12%, transparent);
		color: var(--color-error);
	}
</style>
