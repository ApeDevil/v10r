<script lang="ts">
import type { Snippet } from 'svelte';
import { cn } from '$lib/utils/cn';

interface Props {
	header?: Snippet;
	footer?: Snippet;
	children?: Snippet;
	class?: string;
	/** Anchor id — lets a card act as a NavSection scrollspy target. */
	id?: string;
}

let { header, footer, children, class: className, id }: Props = $props();
</script>

<article
	{id}
	class={cn(
		'rounded-lg border border-border bg-surface-1 shadow-sm',
		// Anchor cards must clear the sticky NavSection chip bar. Spelled as an arbitrary
		// value because the project spacing scale overrides Tailwind's for the keys it
		// defines (`scroll-mt-7` is 2rem, not 1.75rem) — a bare numeric class here would
		// read as the Tailwind scale while silently depending on preset fallback.
		id && 'scroll-mt-[5rem]',
		className,
	)}
>
	{#if header}
		<header class="flex flex-col gap-4 border-b border-border px-fluid-4 py-fluid-3">
			{@render header()}
		</header>
	{/if}

	{#if children}
		<div class="px-fluid-4 py-fluid-4">
			{@render children()}
		</div>
	{/if}

	{#if footer}
		<footer class="border-t border-border px-fluid-4 py-fluid-3">
			{@render footer()}
		</footer>
	{/if}
</article>
