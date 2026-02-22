<script lang="ts">
	import type { PipelineState } from './pipeline-state.svelte';
	import PipelineGraph from './PipelineGraph.svelte';
	import NodeDetail from './NodeDetail.svelte';

	interface Props {
		state: PipelineState;
	}

	let { state }: Props = $props();

	const statusLabel = $derived.by(() => {
		if (state.isActive) return 'Running';
		if (state.totalDurationMs > 0) return `${state.totalDurationMs}ms`;
		return 'Idle';
	});
</script>

<div class="rag-pipeline">
	<div class="pipeline-header">
		<span class="pipeline-title">Pipeline</span>
		<span
			class="pipeline-status"
			class:status-active={state.isActive}
			class:status-done={!state.isActive && state.totalDurationMs > 0}
		>
			{#if state.isActive}
				<span class="status-dot"></span>
			{/if}
			{statusLabel}
		</span>
	</div>

	<PipelineGraph steps={state.steps} onselect={(id) => state.selectStep(id)} />

	{#if state.selectedStep && (state.selectedStep.status === 'done' || state.selectedStep.status === 'error')}
		<NodeDetail step={state.selectedStep} onclose={() => state.selectStep(null)} />
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
