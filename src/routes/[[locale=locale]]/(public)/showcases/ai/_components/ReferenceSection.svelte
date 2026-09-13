<script lang="ts">
import type { Snippet } from 'svelte';
import { page } from '$app/state';
import { Badge, Typography } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';

// One implementation-reference section, folded by default. A native <details> keeps every
// old anchor id resolvable: a `#guard` link from the deskbot page (or from the nav) opens the
// section it names, which an accordion primitive cannot do from a hash.
interface Props {
	id: string;
	title: string;
	claim?: string;
	shared?: boolean;
	/** The sibling page's matching anchor, when the two surfaces can be compared. */
	compare?: string;
	compareSurface?: string;
	children: Snippet;
}

let { id, title, claim, shared = false, compare, compareSurface = 'deskbot', children }: Props = $props();

let open = $state(false);

$effect(() => {
	if (page.url.hash === `#${id}`) open = true;
});
</script>

<details {id} class="reference" bind:open>
	<summary class="summary">
		<span class="marker" aria-hidden="true">
			<span class={open ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'}></span>
		</span>
		<Typography variant="h3" as="h3" class="reference-title">{title}</Typography>
		{#if shared}
			<Badge variant="secondary">{m.showcase_ai_shared_badge()}</Badge>
		{/if}
		{#if compare}
			<a class="compare" href={compare} onclick={(e) => e.stopPropagation()}>
				{m.showcase_ai_compare_link({ surface: compareSurface })}
			</a>
		{/if}
	</summary>
	<div class="body">
		{#if claim}
			<p class="claim">{claim}</p>
		{/if}
		{@render children()}
	</div>
</details>

<style>
	.reference {
		scroll-margin-top: 5rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
	}

	.summary {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		flex-wrap: wrap;
		padding: var(--spacing-3) var(--spacing-4);
		cursor: pointer;
		list-style: none;
	}

	.summary::-webkit-details-marker {
		display: none;
	}

	.summary:focus-visible {
		outline: none;
		box-shadow: inset 0 0 0 2px var(--color-primary);
		border-radius: var(--radius-lg);
	}

	.marker {
		display: inline-flex;
		color: var(--color-muted);
	}

	.summary :global(.reference-title) {
		margin: 0;
		font-size: var(--text-fluid-lg);
	}

	.compare {
		margin-left: auto;
		font-size: var(--text-fluid-xs);
		color: var(--color-primary);
		white-space: nowrap;
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		padding: 0 var(--spacing-4) var(--spacing-4);
	}

	.claim {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.6;
		max-width: 70ch;
	}
</style>
