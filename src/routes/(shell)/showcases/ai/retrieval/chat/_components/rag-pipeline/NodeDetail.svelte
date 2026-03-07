<script lang="ts">
	import type { PipelineStepState, TierDetail, RankDetail, ContextDetail, EmbedDetail, ChunkSummary } from '$lib/types/pipeline';
	import ChunkList from './ChunkList.svelte';

	interface Props {
		step: PipelineStepState;
		chunks?: ChunkSummary[];
		onclose: () => void;
		onexpand?: () => void;
	}

	let { step, chunks = [], onclose, onexpand }: Props = $props();

	const hasChunks = $derived(chunks.length > 0);
</script>

<div class="node-detail" role="region" aria-label="Step details for {step.label}">
	<div class="detail-header">
		<span class="detail-title">{step.label}</span>
		<div class="detail-actions">
			{#if hasChunks && onexpand}
				<button class="detail-expand" onclick={onexpand} aria-label="Expand chunk details">
					<span class="i-lucide-maximize-2 h-3 w-3"></span>
				</button>
			{/if}
			<button class="detail-close" onclick={onclose} aria-label="Close detail panel">
				<span class="i-lucide-x h-3 w-3"></span>
			</button>
		</div>
	</div>

	{#if step.error}
		<div class="detail-error">
			{step.error}
		</div>
	{/if}

	{#if step.detail}
		<div class="detail-grid">
			{#if step.detail.kind === 'embed'}
				{@const d = step.detail as EmbedDetail}
				<span class="detail-key">Dimensions</span>
				<span class="detail-val">{d.dimensions}</span>
			{:else if step.detail.kind === 'tier'}
				{@const d = step.detail as TierDetail}
				<span class="detail-key">Chunks found</span>
				<span class="detail-val">{d.chunksFound}</span>
				{#if d.topSources.length > 0}
					<span class="detail-key">Top sources</span>
					<div class="detail-sources">
						{#each d.topSources as src}
							<div class="detail-source">
								<span class="source-title">{src.title}</span>
								<span class="source-score">{src.score}</span>
							</div>
						{/each}
					</div>
				{/if}
			{:else if step.detail.kind === 'rank'}
				{@const d = step.detail as RankDetail}
				<span class="detail-key">Input</span>
				<span class="detail-val">{d.inputChunks} chunks</span>
				<span class="detail-key">Output</span>
				<span class="detail-val">{d.outputChunks} chunks</span>
				<span class="detail-key">Method</span>
				<span class="detail-val">{d.method === 'rrf' ? 'Reciprocal Rank Fusion' : 'Single tier'}</span>
			{:else if step.detail.kind === 'context'}
				{@const d = step.detail as ContextDetail}
				<span class="detail-key">Chunks</span>
				<span class="detail-val">{d.chunkCount}</span>
				<span class="detail-key">Est. tokens</span>
				<span class="detail-val">~{d.tokenEstimate}</span>
			{/if}
		</div>
	{/if}

	{#if step.durationMs !== undefined}
		<div class="detail-timing">
			{step.durationMs}ms
		</div>
	{/if}

	{#if hasChunks}
		<div class="detail-chunks">
			<ChunkList {chunks} />
		</div>
	{/if}
</div>

<style>
	.node-detail {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-3);
		background-color: color-mix(in srgb, var(--color-surface-2) 80%, transparent);
		animation: detail-enter 250ms ease-out;
	}

	@keyframes detail-enter {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.node-detail {
			animation: none;
		}
	}

	.detail-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--spacing-2);
	}

	.detail-actions {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.detail-expand {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border: none;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--color-muted);
		cursor: pointer;
	}

	.detail-expand:hover {
		color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
	}

	.detail-title {
		font-size: 12px;
		font-weight: 600;
		color: var(--color-fg);
	}

	.detail-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border: none;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--color-muted);
		cursor: pointer;
	}

	.detail-close:hover {
		color: var(--color-fg);
		background: color-mix(in srgb, var(--color-muted) 15%, transparent);
	}

	.detail-error {
		font-size: 11px;
		color: var(--color-error-fg);
		padding: var(--spacing-2);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-error-fg) 10%, transparent);
		margin-bottom: var(--spacing-2);
	}

	.detail-grid {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--spacing-1) var(--spacing-3);
		font-size: 11px;
	}

	.detail-key {
		color: var(--color-muted);
	}

	.detail-val {
		color: var(--color-fg);
	}

	.detail-sources {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.detail-source {
		display: flex;
		justify-content: space-between;
		gap: var(--spacing-2);
	}

	.source-title {
		color: var(--color-fg);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.source-score {
		color: var(--color-muted);
		flex-shrink: 0;
	}

	.detail-timing {
		font-size: 10px;
		color: var(--color-muted);
		text-align: right;
		margin-top: var(--spacing-2);
	}

	.detail-chunks {
		margin-top: var(--spacing-2);
		padding-top: var(--spacing-2);
		border-top: 1px solid var(--color-border);
	}
</style>
