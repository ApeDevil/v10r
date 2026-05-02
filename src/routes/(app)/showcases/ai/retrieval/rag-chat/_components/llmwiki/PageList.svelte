<script lang="ts">
import type { ChunkSummary } from '$lib/types/pipeline';
import type { LlmwikiTraceState } from './llmwiki-trace.svelte';
import PageCard from './PageCard.svelte';

interface Props {
	trace: LlmwikiTraceState;
}

let { trace }: Props = $props();

const pages = $derived(trace.pages);
</script>

{#if pages.length === 0}
	<p class="empty">No pages matched.</p>
{:else}
	<ul class="page-list">
		{#each pages as page (page.chunkId)}
			<li>
				<PageCard {page} status={resolveStatus(page)} />
			</li>
		{/each}
	</ul>
{/if}

<script module lang="ts">
	function resolveStatus(_page: ChunkSummary): 'none' {
		// Pages themselves don't carry a verdict — only drilled chunks do.
		// A future refinement can map chunkId → pageSlug when verifyCitations
		// returns pageSlug alongside each verdict.
		return 'none';
	}
</script>

<style>
	.page-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}
	.empty {
		font-size: 12px;
		color: var(--color-muted);
	}
</style>
