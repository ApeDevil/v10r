<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';

	interface Props extends HTMLAnchorAttributes {
		href: string;
		title: string;
		description?: string;
		icon?: string;
		children?: Snippet;
		class?: string;
	}

	let { href, title, description, icon, children, class: className, ...rest }: Props = $props();
</script>

<a
	{href}
	class={cn(
		'flex flex-col gap-3',
		'px-fluid-4 py-fluid-5',
		'bg-bg border border-border rounded-lg',
		'no-underline',
		'transition-all duration-fast',
		'hover:border-primary hover:shadow-md hover:-translate-y-0.5',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary',
		className
	)}
	{...rest}
>
	{#if icon}
		<span class="text-5xl" aria-hidden="true">{icon}</span>
	{/if}

	{#if children}
		{@render children()}
	{:else}
		<h2 class="text-2xl font-medium text-fg m-0">{title}</h2>
		{#if description}
			<p class="text-sm text-muted m-0">{description}</p>
		{/if}
	{/if}
</a>

<style>
	@media (prefers-reduced-motion: reduce) {
		a {
			transition: none;
		}

		a:hover {
			transform: none;
		}
	}
</style>
