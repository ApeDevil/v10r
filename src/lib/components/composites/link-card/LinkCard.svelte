<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { localizeHref } from '$lib/i18n';
import { cn } from '$lib/utils/cn';

interface Sublink {
	label: string;
	href: string;
}

interface Props extends HTMLAttributes<HTMLDivElement> {
	href: string;
	title: string;
	description?: string;
	icon?: string;
	sublinks?: Sublink[];
	children?: Snippet;
	class?: string;
}

let { href, title, description, icon, sublinks, children, class: className, ...rest }: Props = $props();
</script>

<div
	class={cn(
		'card-wrapper',
		'relative',
		'flex flex-col gap-3',
		'px-fluid-4 py-fluid-5',
		'bg-surface-1 border border-border rounded-lg',
		'transition-all duration-fast',
		className
	)}
	{...rest}
>
	{#if icon || sublinks?.length}
		<div class="flex items-start justify-between gap-3">
			{#if icon}
				<span class="{icon} text-3xl text-primary shrink-0" aria-hidden="true"></span>
			{/if}
			{#if sublinks?.length}
				<div class="flex flex-wrap justify-end gap-x-2 gap-y-1 text-xs ml-auto">
					{#each sublinks as sublink}
						<a href={localizeHref(sublink.href)} class="sublink">
							{sublink.label}
						</a>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	{#if children}
		{@render children()}
	{:else}
		<a href={localizeHref(href)} class="card-link no-underline">
			<h2 class="text-2xl font-medium text-fg m-0">{title}</h2>
			{#if description}
				<p class="text-sm text-muted m-0 mt-3">{description}</p>
			{/if}
		</a>
	{/if}
</div>

<style>
	/* Stretched link: title anchor covers the entire card */
	.card-link::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 0.5rem;
	}

	.card-link:focus-visible {
		outline: none;
	}

	.card-link:focus-visible::after {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	/* Card hover effect */
	.card-wrapper:hover {
		border-color: var(--color-primary);
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
		transform: translateY(-2px);
	}

	/* Suppress card hover when sublink is hovered */
	.card-wrapper:has(.sublink:hover) {
		border-color: var(--color-border);
		box-shadow: none;
		transform: none;
	}

	:global(.dark) .card-wrapper:hover {
		box-shadow: 0 0 20px color-mix(in srgb, var(--color-primary) 30%, transparent),
			0 0 8px color-mix(in srgb, var(--color-primary) 20%, transparent);
	}

	:global(.dark) .card-wrapper:has(.sublink:hover) {
		box-shadow: none;
	}

	/* Sublinks sit above the stretched link */
	.sublink {
		position: relative;
		z-index: 1;
		border-radius: 0.25rem;
		padding: 0.25rem 0.5rem;
		text-decoration: none;
		color: var(--color-primary);
		transition: color 150ms, background-color 150ms;
	}

	.sublink:hover {
		text-decoration: underline;
		background-color: color-mix(in srgb, var(--color-primary-container) 40%, transparent);
	}

	.sublink:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.sublink:active {
		background-color: color-mix(in srgb, var(--color-primary-container) 60%, transparent);
	}

	@media (prefers-reduced-motion: reduce) {
		.card-wrapper {
			transition: none;
		}

		.card-wrapper:hover {
			transform: none;
		}

		.sublink {
			transition: none;
		}
	}
</style>
