<script lang="ts">
import type { ChunkSummary, LlmwikiCitationStatus } from '$lib/types/pipeline';
import CitationBadge from './CitationBadge.svelte';

interface Props {
	page: ChunkSummary;
	/** Verdict for any drilled chunk linked to this page, if known. */
	status?: LlmwikiCitationStatus;
}

let { page, status = 'none' }: Props = $props();
</script>

<article class="page-card" data-status={status}>
	<header class="page-header">
		<h4 class="page-title">{page.documentTitle}</h4>
		{#if status !== 'none'}
			<CitationBadge {status} />
		{/if}
	</header>
	<p class="page-tldr">{page.contentPreview}</p>
	<footer class="page-footer">
		<span class="slug">slug: <code>{page.chunkId}</code></span>
	</footer>
</article>

<style>
	.page-card {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-left-width: 3px;
		border-radius: var(--radius-sm);
		background: var(--color-surface-1);
	}

	.page-card[data-status='quote'] {
		border-left-color: var(--color-primary);
	}
	.page-card[data-status='paraphrase'] {
		border-left-color: var(--color-success-fg, var(--color-accent));
	}
	.page-card[data-status='drifted'] {
		border-left-color: var(--color-warning-fg, #c2860a);
	}
	.page-card[data-status='uncited'] {
		border-left-color: var(--color-muted);
	}

	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-2);
	}

	.page-title {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		color: var(--color-fg);
	}

	.page-tldr {
		margin: 0;
		font-size: 12px;
		line-height: 1.5;
		color: var(--color-muted);
	}

	.page-footer {
		display: flex;
		gap: var(--spacing-2);
		font-size: 10px;
		color: var(--color-muted);
	}

	.slug code {
		font-family: ui-monospace, monospace;
	}
</style>
