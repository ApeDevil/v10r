<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { buttonVariants, type ButtonVariants } from './button';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes, ButtonVariants {
		children: Snippet;
		class?: string;
	}

	let { variant, size, class: className, children, ...rest }: Props = $props();
</script>

<button class={cn(buttonVariants({ variant, size }), className)} {...rest}>
	{@render children()}
</button>

<style>
	button {
		transition:
			box-shadow var(--duration-fast) var(--ease-default),
			translate var(--duration-fast) var(--ease-out),
			filter var(--duration-fast) var(--ease-default),
			background-color var(--duration-fast) var(--ease-default),
			color var(--duration-fast) var(--ease-default);
	}

	/* Universal hover: lift */
	button:hover:not(:disabled) {
		translate: 0 -2px;
	}

	/* Default: fg background, bg text → pops against page */
	button:global(.bg-fg) {
		background-color: var(--color-fg);
		color: var(--color-bg);
	}

	button:global(.bg-fg):hover:not(:disabled) {
		background-color: var(--color-primary);
		color: var(--color-bg);
		box-shadow: 0 0 16px 4px color-mix(in srgb, var(--color-primary) 45%, transparent);
	}

	/* Primary: uses primary-bg/fg tokens */
	button:global(.bg-primary) {
		background-color: var(--color-primary-bg);
		color: var(--color-primary-fg);
	}

	button:global(.bg-primary):hover:not(:disabled) {
		background-color: var(--color-primary-hover);
		color: var(--color-bg);
		filter: none;
		box-shadow: 0 0 16px 4px color-mix(in srgb, var(--color-primary-hover) 45%, transparent);
	}

	/* Secondary: uses secondary-bg/fg tokens */
	button:global(.bg-border) {
		background-color: var(--color-secondary-bg);
		color: var(--color-secondary-fg);
	}

	button:global(.bg-border):hover:not(:disabled) {
		background-color: var(--color-primary-light);
		filter: none;
		box-shadow: 0 0 12px 2px color-mix(in srgb, var(--color-primary-light) 40%, transparent);
	}

	/* Outline: fg-colored border */
	button:global(.border-border) {
		border-width: 1px;
		border-style: solid;
		border-color: var(--color-fg);
	}

	/* Outline hover: primary text & border */
	button:global(.border-border):hover:not(:disabled) {
		color: var(--color-primary);
		border-color: var(--color-primary);
		box-shadow: 0 2px 8px 0 color-mix(in srgb, var(--color-primary) 20%, transparent);
	}

	:global(.dark) button:global(.border-border):hover:not(:disabled) {
		box-shadow: 0 0 14px 2px color-mix(in srgb, var(--color-primary) 20%, transparent);
	}

	/* Ghost hover: shadow in light, glow in dark */
	button:global(.text-fg):not(:global(.bg-fg)):not(:global(.bg-primary)):not(:global(.bg-border)):not(:global(.border-error)):hover:not(:disabled) {
		color: var(--color-primary);
		box-shadow: 0 2px 8px 0 color-mix(in srgb, var(--color-fg) 15%, transparent);
	}

	:global(.dark) button:global(.text-fg):not(:global(.bg-fg)):not(:global(.bg-primary)):not(:global(.bg-border)):not(:global(.border-error)):hover:not(:disabled) {
		box-shadow: 0 0 10px 2px color-mix(in srgb, var(--color-fg) 15%, transparent);
	}

	/* Destructive: outline → filled on hover */
	button:global(.border-error) {
		border-width: 1px;
		border-style: solid;
		border-color: var(--color-error);
		color: var(--color-error);
	}

	button:global(.border-error):hover:not(:disabled) {
		background-color: var(--color-error-bg);
		color: var(--color-error-fg);
		border-color: var(--color-error-bg);
		box-shadow: 0 0 16px 4px color-mix(in srgb, var(--color-error-bg) 45%, transparent);
	}

	/* Large size: UnoCSS doesn't reliably extract h-12/px-6 from .ts */
	button:global(.text-lg) {
		height: 3.5rem;
		padding-inline: 1.5rem;
	}

	button:active:not(:disabled) {
		box-shadow: none;
		translate: 0 0;
		filter: none;
	}
</style>
