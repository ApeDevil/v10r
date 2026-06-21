<script lang="ts">
import CitationBadge from '$lib/components/chat/CitationBadge.svelte';
import type { SourceChunk } from '$lib/components/chat/citation-types';

interface Props {
	chunk: SourceChunk;
}

let { chunk }: Props = $props();
</script>

<article class="chunk-view">
	<header class="chunk-head">
		<span class="chunk-title" title={chunk.documentTitle}>{chunk.documentTitle}</span>
		<CitationBadge verdict={chunk.verdict} />
	</header>
	<span class="chunk-level">{chunk.level}</span>
	<!-- Plain text: Svelte auto-escapes, so chunk content can never inject HTML. -->
	<div class="chunk-body">{chunk.content}</div>
</article>

<style>
	.chunk-view {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background-color: color-mix(in srgb, var(--color-muted) 6%, transparent);
	}

	.chunk-head {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		min-width: 0;
	}

	.chunk-title {
		flex: 1;
		min-width: 0;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-fg);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.chunk-level {
		font-size: 0.625rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-muted);
	}

	.chunk-body {
		font-size: 0.8125rem;
		line-height: 1.5;
		color: var(--color-body);
		white-space: pre-wrap;
		word-break: break-word;
	}
</style>
