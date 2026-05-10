<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
import { cn } from '$lib/utils/cn';
import { type ButtonVariants, buttonVariants } from './button';

type Props = ButtonVariants & {
	children: Snippet;
	class?: string;
	href?: string;
} & Omit<HTMLButtonAttributes, 'class' | 'children'> &
	Omit<HTMLAnchorAttributes, 'class' | 'children'>;

let { variant, size, class: className, children, href, ...rest }: Props = $props();
</script>

{#if href}
	<a {href} class={cn(buttonVariants({ variant, size }), className)} {...rest}>
		{@render children()}
	</a>
{:else}
	<button class={cn(buttonVariants({ variant, size }), className)} {...rest}>
		{@render children()}
	</button>
{/if}

<style>
	:where(button, a) {
		transition:
			box-shadow var(--duration-fast) var(--ease-default),
			translate var(--duration-fast) var(--ease-out),
			filter var(--duration-fast) var(--ease-default),
			background-color var(--duration-fast) var(--ease-default),
			color var(--duration-fast) var(--ease-default);
	}

	a {
		text-decoration: none;
	}

	/* Universal hover: lift */
	:where(button, a):hover:not(:disabled) {
		translate: 0 -2px;
	}

	/* Default: fg background, bg text → pops against page */
	:where(button, a):global(.bg-fg) {
		background-color: var(--color-fg);
		color: var(--color-bg);
	}

	:where(button, a):global(.bg-fg):hover:not(:disabled) {
		background-color: var(--color-primary);
		color: var(--color-bg);
		box-shadow: 0 0 16px 4px color-mix(in srgb, var(--color-primary) 45%, transparent);
	}

	/* Primary: saturated primary surface with on-primary text */
	:where(button, a):global(.bg-primary) {
		background-color: var(--color-primary);
		color: var(--color-on-primary);
	}

	:where(button, a):global(.bg-primary):hover:not(:disabled) {
		background-color: var(--color-primary-hover);
		color: var(--color-on-primary);
		filter: none;
		box-shadow: 0 0 16px 4px color-mix(in srgb, var(--color-primary-hover) 45%, transparent);
	}

	/* Secondary: uses secondary/on-secondary tokens */
	:where(button, a):global(.bg-border) {
		background-color: var(--color-secondary);
		color: var(--color-on-secondary);
	}

	:where(button, a):global(.bg-border):hover:not(:disabled) {
		background-color: var(--color-primary-dim);
		filter: none;
		box-shadow: 0 0 12px 2px color-mix(in srgb, var(--color-primary-dim) 40%, transparent);
	}

	/* Outline: fg-colored border */
	:where(button, a):global(.border-border) {
		border-width: 1px;
		border-style: solid;
		border-color: var(--color-fg);
	}

	/* Outline hover: primary text & border */
	:where(button, a):global(.border-border):hover:not(:disabled) {
		color: var(--color-primary);
		border-color: var(--color-primary);
		box-shadow: 0 2px 8px 0 color-mix(in srgb, var(--color-primary) 20%, transparent);
	}

	:global(.dark) :where(button, a):global(.border-border):hover:not(:disabled) {
		box-shadow: 0 0 14px 2px color-mix(in srgb, var(--color-primary) 20%, transparent);
	}

	/* Ghost hover: shadow in light, glow in dark */
	:where(button, a):global(.text-fg):not(:global(.bg-fg)):not(:global(.bg-primary)):not(:global(.bg-border)):not(:global(.border-error)):hover:not(:disabled) {
		color: var(--color-primary);
		box-shadow: 0 2px 8px 0 color-mix(in srgb, var(--color-fg) 15%, transparent);
	}

	:global(.dark) :where(button, a):global(.text-fg):not(:global(.bg-fg)):not(:global(.bg-primary)):not(:global(.bg-border)):not(:global(.border-error)):hover:not(:disabled) {
		box-shadow: 0 0 10px 2px color-mix(in srgb, var(--color-fg) 15%, transparent);
	}

	/* Destructive: outline → filled on hover */
	:where(button, a):global(.border-error) {
		border-width: 1px;
		border-style: solid;
		border-color: var(--color-error);
		color: var(--color-error);
	}

	:where(button, a):global(.border-error):hover:not(:disabled) {
		background-color: var(--color-error-bg);
		color: var(--color-error-fg);
		border-color: var(--color-error-bg);
		box-shadow: 0 0 16px 4px color-mix(in srgb, var(--color-error-bg) 45%, transparent);
	}

	/* Large size: UnoCSS doesn't reliably extract h-12/px-6 from .ts */
	:where(button, a):global(.text-lg) {
		height: 3.5rem;
		padding-inline: 1.5rem;
	}

	:where(button, a):active:not(:disabled) {
		box-shadow: none;
		translate: 0 0;
		filter: none;
	}
</style>
