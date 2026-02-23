<script lang="ts">
	import type {
		PipelineStepState,
		PipelineStepId,
		StepDetail,
		EmbedDetail,
		TierDetail,
		RankDetail,
		ContextDetail,
	} from '$lib/types/pipeline';
	import { PIPELINE_STEPS } from '$lib/types/pipeline';
	import PipelineNode from './PipelineNode.svelte';
	import PipelineEdge from './PipelineEdge.svelte';
	import { SvgTooltip } from '$lib/components/viz';

	interface Props {
		steps: PipelineStepState[];
		chunkCounts?: Record<string, number>;
		onselect: (id: PipelineStepId) => void;
	}

	let { steps, chunkCounts = {}, onselect }: Props = $props();

	/** Hover state */
	let hoveredStepId = $state<PipelineStepId | null>(null);
	let hoveredEdge = $state<{ from: PipelineStepId; to: PipelineStepId } | null>(null);

	const VIEWBOX_W = 240;
	const VIEWBOX_H = 290;

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

	function handleNodeHover(id: PipelineStepId | null) {
		hoveredStepId = id;
		if (id) hoveredEdge = null;
	}

	function handleEdgeHover(edge: { from: PipelineStepId; to: PipelineStepId } | null) {
		hoveredEdge = edge;
		if (edge) hoveredStepId = null;
	}

	/** Label lookup for edge tooltip */
	const stepLabels: Record<PipelineStepId, string> = Object.fromEntries(
		PIPELINE_STEPS.map((s) => [s.id, s.label])
	) as Record<PipelineStepId, string>;

	/** Tooltip position as percentage of container */
	const tooltipPos = $derived.by(() => {
		if (hoveredStepId) {
			const pos = positions[hoveredStepId];
			return {
				left: (pos.x / VIEWBOX_W) * 100,
				top: (pos.y / VIEWBOX_H) * 100,
			};
		}
		if (hoveredEdge) {
			const p1 = positions[hoveredEdge.from];
			const p2 = positions[hoveredEdge.to];
			return {
				left: ((p1.x + p2.x) / 2 / VIEWBOX_W) * 100,
				top: ((p1.y + p2.y) / 2 / VIEWBOX_H) * 100,
			};
		}
		return null;
	});

	/** Derive tooltip text from step status + detail */
	function tooltipText(step: PipelineStepState): string {
		switch (step.status) {
			case 'pending': return 'Waiting\u2026';
			case 'active': return 'Processing\u2026';
			case 'skipped': return 'Skipped';
			case 'error': return step.error ?? 'Error';
			case 'done': return doneText(step.detail, step.durationMs);
		}
	}

	function doneText(detail: StepDetail | undefined, ms: number | undefined): string {
		const timing = ms !== undefined ? ` \u00b7 ${ms}ms` : '';
		if (!detail) return `Done${timing}`;
		switch (detail.kind) {
			case 'embed': return `${(detail as EmbedDetail).dimensions} dimensions${timing}`;
			case 'tier': {
				const d = detail as TierDetail;
				return `${d.chunksFound} chunks found${timing}`;
			}
			case 'rank': {
				const d = detail as RankDetail;
				return `${d.inputChunks} \u2192 ${d.outputChunks} chunks (${d.method.toUpperCase()})${timing}`;
			}
			case 'context': {
				const d = detail as ContextDetail;
				return `${d.chunkCount} chunks, ~${d.tokenEstimate} tokens${timing}`;
			}
			case 'generate': return `Generating response${timing}`;
		}
	}

	const tooltipContent = $derived.by(() => {
		if (hoveredStepId) {
			const step = getStep(hoveredStepId);
			return { label: step.label, text: tooltipText(step) };
		}
		if (hoveredEdge) {
			return {
				label: `${stepLabels[hoveredEdge.from]} \u2192 ${stepLabels[hoveredEdge.to]}`,
				text: null,
			};
		}
		return null;
	});

	const showTooltip = $derived(tooltipPos !== null && tooltipContent !== null);
</script>

<div class="graph-container">
	<svg viewBox="0 0 {VIEWBOX_W} {VIEWBOX_H}" class="pipeline-graph" aria-label="RAG pipeline visualization">
		<!-- Edges (rendered behind nodes) -->
		{#each edges as [from, to]}
			{@const x1 = positions[from].x}
			{@const y1 = positions[from].y + 14}
			{@const x2 = positions[to].x}
			{@const y2 = positions[to].y - 14}
			<PipelineEdge
				{x1} {y1} {x2} {y2}
				{from} {to}
				status={edgeStatus(from, to)}
				hovered={hoveredEdge?.from === from && hoveredEdge?.to === to}
				onhover={handleEdgeHover}
			/>

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
				hovered={hoveredStepId === step.id}
				{onselect}
				onhover={handleNodeHover}
			/>
		{/each}
	</svg>

	<SvgTooltip x={tooltipPos?.left ?? 0} y={tooltipPos?.top ?? 0} visible={showTooltip}>
		<span class="tooltip-label">{tooltipContent?.label}</span>
		{#if tooltipContent?.text}
			<span class="tooltip-text">{tooltipContent.text}</span>
		{/if}
	</SvgTooltip>
</div>

<style>
	.graph-container {
		position: relative;
		width: 100%;
		max-width: 240px;
	}

	.pipeline-graph {
		width: 100%;
		height: auto;
		display: block;
	}

	.edge-count {
		font-size: 9px;
		fill: var(--color-muted);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.tooltip-label {
		font-size: 11px;
		font-weight: 600;
		color: var(--color-fg);
	}

	.tooltip-text {
		font-size: 10px;
		color: var(--color-muted);
	}
</style>
