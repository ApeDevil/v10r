<script lang="ts">
	import type { ChunkSummary } from '$lib/types/pipeline';
	import ChunkCard from './ChunkCard.svelte';

	interface FunnelStats {
		found: number;
		kept: number;
		context: number;
	}

	interface Props {
		chunks: ChunkSummary[];
		funnelStats?: FunnelStats;
		maxHeight?: string;
	}

	let { chunks, funnelStats, maxHeight = '200px' }: Props = $props();

	const sorted = $derived(
		[...chunks].sort((a, b) => {
			if (a.survived !== b.survived) return a.survived ? -1 : 1;
			return b.score - a.score;
		}),
	);

	const funnelTotal = $derived(funnelStats ? Math.max(funnelStats.found, 1) : 0);
</script>

{#if funnelStats}
	<div class="funnel-bar" aria-label="Chunk funnel: {funnelStats.found} found, {funnelStats.kept} kept, {funnelStats.context} in context">
		<div class="funnel-segment found" style:flex-grow={funnelStats.found / funnelTotal}>
			<span class="funnel-label">{funnelStats.found} found</span>
		</div>
		<span class="funnel-arrow">&#8594;</span>
		<div class="funnel-segment kept" style:flex-grow={funnelStats.kept / funnelTotal}>
			<span class="funnel-label">{funnelStats.kept} kept</span>
		</div>
		<span class="funnel-arrow">&#8594;</span>
		<div class="funnel-segment ctx" style:flex-grow={funnelStats.context / funnelTotal}>
			<span class="funnel-label">{funnelStats.context} context</span>
		</div>
	</div>
{/if}

<div class="chunk-list" style:max-height={maxHeight}>
	{#each sorted as chunk (chunk.chunkId)}
		<ChunkCard {chunk} />
	{/each}

	{#if sorted.length === 0}
		<div class="chunk-empty">No chunks</div>
	{/if}
</div>

<style>
	.funnel-bar {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: var(--spacing-1) 0;
		margin-bottom: var(--spacing-2);
	}

	.funnel-segment {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 18px;
		border-radius: var(--radius-sm);
		min-width: 0;
	}

	.funnel-label {
		font-size: 9px;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		padding: 0 4px;
	}

	.funnel-segment.found {
		background: color-mix(in srgb, var(--color-muted) 20%, transparent);
		color: var(--color-muted);
	}

	.funnel-segment.kept {
		background: color-mix(in srgb, var(--color-primary) 20%, transparent);
		color: var(--color-primary);
	}

	.funnel-segment.ctx {
		background: color-mix(in srgb, var(--color-primary) 30%, transparent);
		color: var(--color-primary);
	}

	.funnel-arrow {
		font-size: 10px;
		color: var(--color-muted);
		flex-shrink: 0;
	}

	.chunk-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		overflow-y: auto;
	}

	.chunk-empty {
		font-size: 11px;
		color: var(--color-muted);
		text-align: center;
		padding: var(--spacing-3);
	}
</style>
