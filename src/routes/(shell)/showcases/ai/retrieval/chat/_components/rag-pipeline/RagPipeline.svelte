<script lang="ts">
import ChunkDetailPanel from './ChunkDetailPanel.svelte';
import NodeDetail from './NodeDetail.svelte';
import PipelineGraph from './PipelineGraph.svelte';
import type { PipelineState } from './pipeline-state.svelte';

interface Props {
	pipeline: PipelineState;
}

let { pipeline }: Props = $props();

let expanded = $state(false);

const statusLabel = $derived.by(() => {
	if (pipeline.isActive) return 'Running';
	if (pipeline.totalDurationMs > 0) return `${pipeline.totalDurationMs}ms`;
	return 'Idle';
});

const selectedChunks = $derived(pipeline.selectedStepId ? pipeline.chunksForStep(pipeline.selectedStepId) : []);
</script>

<div class="rag-pipeline">
	<div class="pipeline-header">
		<span class="pipeline-title">Retrieval Trace</span>
		<span
			class="pipeline-status"
			class:status-active={pipeline.isActive}
			class:status-done={!pipeline.isActive && pipeline.totalDurationMs > 0}
		>
			{#if pipeline.isActive}
				<span class="status-dot"></span>
			{/if}
			{statusLabel}
		</span>
	</div>

	{#if expanded && pipeline.chunkData}
		<ChunkDetailPanel
			chunkData={pipeline.chunkData}
			onclose={() => { expanded = false; }}
		/>
	{:else}
		<PipelineGraph
			steps={pipeline.steps}
			chunkCounts={pipeline.chunkCounts}
			onselect={(id) => pipeline.selectStep(id)}
		/>

		{#if pipeline.selectedStep && (pipeline.selectedStep.status === 'done' || pipeline.selectedStep.status === 'error')}
			<NodeDetail
				step={pipeline.selectedStep}
				chunks={selectedChunks}
				onclose={() => pipeline.selectStep(null)}
				onexpand={pipeline.chunkData ? () => { expanded = true; } : undefined}
			/>
		{/if}
	{/if}
</div>

<style>
	.rag-pipeline {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.pipeline-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.pipeline-title {
		font-size: 13px;
		font-weight: 600;
		color: var(--color-fg);
	}

	.pipeline-status {
		font-size: 11px;
		color: var(--color-muted);
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
	}

	.status-active {
		color: var(--color-primary);
	}

	.status-done {
		color: var(--color-muted);
	}

	.status-dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background-color: var(--color-primary);
		animation: pulse-dot 1s ease-in-out infinite;
	}

	@keyframes pulse-dot {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}

	@media (prefers-reduced-motion: reduce) {
		.status-dot {
			animation: none;
		}
	}
</style>
