<script lang="ts">
import type { ChunkSummary } from '$lib/types/pipeline';

interface Props {
	chunk: ChunkSummary;
}

let { chunk }: Props = $props();

let expanded = $state(false);

const sourceColors: Record<ChunkSummary['source'], string> = {
	vector: 'badge-vector',
	bm25: 'badge-bm25',
	parentChild: 'badge-parent',
	graph: 'badge-graph',
	llmwiki: 'badge-wiki',
};
</script>

<button
	class="chunk-card"
	class:dimmed={!chunk.survived}
	onclick={() => { expanded = !expanded; }}
	aria-expanded={expanded}
>
	<div class="chunk-header">
		<span class="source-badge {sourceColors[chunk.source]}">{chunk.source}</span>
		<span class="chunk-title" class:struck={!chunk.survived}>{chunk.documentTitle}</span>
		<span class="chunk-score">{chunk.score.toFixed(3)}</span>
	</div>

	<div class="chunk-preview" class:preview-expanded={expanded}>
		{chunk.contentPreview}
	</div>

	<div class="chunk-meta">
		{chunk.contentLength.toLocaleString()} chars
	</div>
</button>

<style>
	.chunk-card {
		display: flex;
		flex-direction: column;
		gap: 4px;
		width: 100%;
		padding: var(--spacing-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--surface-2) 60%, transparent);
		cursor: pointer;
		text-align: left;
		font-family: inherit;
		font-size: inherit;
	}

	.chunk-card:hover {
		border-color: var(--color-primary);
	}

	.dimmed {
		opacity: 0.45;
	}

	.chunk-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		min-width: 0;
	}

	.source-badge {
		flex-shrink: 0;
		padding: 1px 5px;
		border-radius: var(--radius-sm);
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.badge-vector {
		background: color-mix(in srgb, var(--color-primary) 15%, transparent);
		color: var(--color-primary);
	}

	.badge-bm25 {
		background: color-mix(in srgb, var(--chart-2) 15%, transparent);
		color: var(--chart-2);
	}

	.badge-graph {
		background: color-mix(in srgb, var(--chart-7) 15%, transparent);
		color: var(--chart-7);
	}

	.badge-parent {
		background: color-mix(in srgb, var(--chart-1) 15%, transparent);
		color: var(--chart-1);
	}

	.badge-wiki {
		background: color-mix(in srgb, var(--chart-5) 15%, transparent);
		color: var(--chart-5);
	}

	.chunk-title {
		flex: 1;
		font-size: 11px;
		font-weight: 500;
		color: var(--color-fg);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.struck {
		text-decoration: line-through;
		text-decoration-color: var(--color-muted);
	}

	.chunk-score {
		flex-shrink: 0;
		font-size: 10px;
		font-variant-numeric: tabular-nums;
		color: var(--color-muted);
	}

	.chunk-preview {
		font-size: 10px;
		line-height: 1.4;
		color: var(--color-muted);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.preview-expanded {
		-webkit-line-clamp: unset;
		line-clamp: unset;
		display: block;
	}

	.chunk-meta {
		font-size: 9px;
		color: var(--color-muted);
		text-align: right;
		opacity: 0.7;
	}
</style>
