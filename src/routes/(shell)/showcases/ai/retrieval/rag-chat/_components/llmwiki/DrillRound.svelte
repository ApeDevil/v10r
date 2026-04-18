<script lang="ts">
import type { ChunkSummary, DrillDetail, PipelineStepState } from '$lib/types/pipeline';
import type { LlmwikiTraceState } from './llmwiki-trace.svelte';
import CitationBadge from './CitationBadge.svelte';

interface Props {
	step: PipelineStepState & { drillOrdinal: number };
	trace: LlmwikiTraceState;
	chunks: ChunkSummary[];
}

let { step, trace, chunks }: Props = $props();

let open = $state(false);

const detail = $derived(step.detail?.kind === 'drill' ? (step.detail as DrillDetail) : null);
</script>

<div class="drill-round">
	<button type="button" class="head" aria-expanded={open} onclick={() => (open = !open)}>
		<span class="i-lucide-chevron-right h-3 w-3 chev" class:open></span>
		<span class="label">{step.label}</span>
		{#if detail}
			<span class="meta">{detail.chunksReturned}/{detail.idsRequested} chunks</span>
		{/if}
		{#if step.durationMs}
			<span class="ms">{step.durationMs}ms</span>
		{/if}
	</button>

	{#if open}
		<ul class="chunk-list">
			{#each chunks as c (c.chunkId)}
				{@const verdict = trace.verdictForChunk(c.chunkId)}
				<li class="chunk-row" data-status={verdict?.status ?? 'none'}>
					<div class="chunk-header">
						<code class="chunk-id">{c.chunkId}</code>
						{#if verdict}
							<CitationBadge status={verdict.status} />
						{/if}
					</div>
					<p class="chunk-preview">{c.contentPreview}</p>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.drill-round {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-surface-1);
	}

	.head {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		width: 100%;
		padding: var(--spacing-2) var(--spacing-3);
		border: none;
		background: transparent;
		cursor: pointer;
		text-align: left;
		color: var(--color-fg);
		font-size: 12px;
	}

	.chev {
		transition: transform 150ms;
	}
	.chev.open {
		transform: rotate(90deg);
	}

	.label {
		font-weight: 600;
	}

	.meta {
		margin-left: auto;
		font-size: 11px;
		color: var(--color-muted);
	}

	.ms {
		font-size: 11px;
		color: var(--color-muted);
		font-variant-numeric: tabular-nums;
	}

	.chunk-list {
		list-style: none;
		margin: 0;
		padding: var(--spacing-2) var(--spacing-3) var(--spacing-3);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		border-top: 1px solid var(--color-border);
	}

	.chunk-row {
		padding: var(--spacing-2);
		border-radius: var(--radius-sm);
		border-left: 3px solid var(--color-border);
		background: var(--color-surface-2, var(--color-surface-1));
	}

	.chunk-row[data-status='quote'] {
		border-left-color: var(--color-primary);
	}
	.chunk-row[data-status='paraphrase'] {
		border-left-color: var(--color-success-fg, var(--color-accent));
	}
	.chunk-row[data-status='drifted'] {
		border-left-color: var(--color-warning-fg, #c2860a);
	}
	.chunk-row[data-status='uncited'] {
		border-left-color: var(--color-muted);
	}

	.chunk-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-2);
		margin-bottom: var(--spacing-1);
	}

	.chunk-id {
		font-family: ui-monospace, monospace;
		font-size: 11px;
		color: var(--color-fg);
	}

	.chunk-preview {
		margin: 0;
		font-size: 11px;
		line-height: 1.5;
		color: var(--color-muted);
	}
</style>
