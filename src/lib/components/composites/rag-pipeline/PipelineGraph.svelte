<script lang="ts">
	import type { PipelineStepState, PipelineStepId } from '$lib/types/pipeline';
	import PipelineNode from './PipelineNode.svelte';
	import PipelineEdge from './PipelineEdge.svelte';

	interface Props {
		steps: PipelineStepState[];
		chunkCounts?: Record<string, number>;
		onselect: (id: PipelineStepId) => void;
	}

	let { steps, chunkCounts = {}, onselect }: Props = $props();

	/** Fixed positions for each step in the DAG */
	const positions: Record<PipelineStepId, { x: number; y: number }> = {
		'embed':   { x: 50, y: 30 },
		'tier-1':  { x: 30, y: 100 },
		'tier-2':  { x: 100, y: 100 },
		'tier-3':  { x: 170, y: 100 },
		'rank':    { x: 100, y: 170 },
		'context': { x: 100, y: 220 },
		'generate':{ x: 100, y: 270 },
	};

	/** Edge connections: from → to */
	const edges: [PipelineStepId, PipelineStepId][] = [
		['embed', 'tier-1'],
		['embed', 'tier-2'],
		['embed', 'tier-3'],
		['tier-1', 'rank'],
		['tier-2', 'rank'],
		['tier-3', 'rank'],
		['rank', 'context'],
		['context', 'generate'],
	];

	function getStep(id: PipelineStepId): PipelineStepState {
		return steps.find((s) => s.id === id)!;
	}

	function edgeStatus(fromId: PipelineStepId, toId: PipelineStepId) {
		const from = getStep(fromId);
		const to = getStep(toId);
		if (from.status === 'skipped' || to.status === 'skipped') return 'skipped';
		if (to.status === 'active') return 'active';
		if (to.status === 'done' || to.status === 'error') return from.status;
		return 'pending';
	}
</script>

<svg viewBox="0 0 240 290" class="pipeline-graph" aria-label="RAG pipeline visualization">
	<!-- Edges (rendered behind nodes) -->
	{#each edges as [from, to]}
		{@const x1 = positions[from].x}
		{@const y1 = positions[from].y + 14}
		{@const x2 = positions[to].x}
		{@const y2 = positions[to].y - 14}
		<PipelineEdge {x1} {y1} {x2} {y2} status={edgeStatus(from, to)} />

		{#if chunkCounts[from] !== undefined && edgeStatus(from, to) === 'done'}
			<text
				x={(x1 + x2) / 2 + (x1 === x2 ? 8 : 0)}
				y={(y1 + y2) / 2}
				class="edge-count"
				dominant-baseline="middle"
				text-anchor={x1 === x2 ? 'start' : 'middle'}
			>{chunkCounts[from]}</text>
		{/if}
	{/each}

	<!-- Nodes -->
	{#each steps as step}
		<PipelineNode
			{step}
			x={positions[step.id].x}
			y={positions[step.id].y}
			{onselect}
		/>
	{/each}
</svg>

<style>
	.pipeline-graph {
		width: 100%;
		max-width: 240px;
		height: auto;
	}

	.edge-count {
		font-size: 9px;
		fill: var(--color-muted);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
</style>
