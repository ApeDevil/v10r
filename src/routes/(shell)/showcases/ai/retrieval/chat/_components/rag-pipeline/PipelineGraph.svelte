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

	/** Zoom/pan state */
	let zoom = $state(1);
	let panX = $state(0);
	let panY = $state(0);
	let svgEl: SVGSVGElement | undefined = $state();
	let isPanning = $state(false);
	let panStartX = 0;
	let panStartY = 0;
	let panStartPanX = 0;
	let panStartPanY = 0;
	let didPan = false;

	const MIN_ZOOM = 0.5;
	const MAX_ZOOM = 4;
	const PAN_THRESHOLD = 3;

	const viewBox = $derived(`${panX} ${panY} ${VIEWBOX_W / zoom} ${VIEWBOX_H / zoom}`);
	const isZoomed = $derived(Math.abs(zoom - 1) > 0.01 || Math.abs(panX) > 0.5 || Math.abs(panY) > 0.5);

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

	/** Tooltip position as percentage of container, accounting for zoom/pan */
	const tooltipPos = $derived.by(() => {
		if (hoveredStepId) {
			const pos = positions[hoveredStepId];
			return {
				left: ((pos.x - panX) * zoom / VIEWBOX_W) * 100,
				top: ((pos.y - panY) * zoom / VIEWBOX_H) * 100,
			};
		}
		if (hoveredEdge) {
			const p1 = positions[hoveredEdge.from];
			const p2 = positions[hoveredEdge.to];
			return {
				left: (((p1.x + p2.x) / 2 - panX) * zoom / VIEWBOX_W) * 100,
				top: (((p1.y + p2.y) / 2 - panY) * zoom / VIEWBOX_H) * 100,
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

	/** Zoom toward cursor on Ctrl/Cmd + scroll (also handles trackpad pinch) */
	function handleWheel(e: WheelEvent) {
		if (!e.ctrlKey && !e.metaKey) return;
		e.preventDefault();
		if (!svgEl) return;

		const factor = e.deltaY > 0 ? 0.9 : 1.1;
		const newZoom = Math.min(Math.max(zoom * factor, MIN_ZOOM), MAX_ZOOM);

		const rect = svgEl.getBoundingClientRect();
		const cursorX = (e.clientX - rect.left) / rect.width;
		const cursorY = (e.clientY - rect.top) / rect.height;

		const oldW = VIEWBOX_W / zoom;
		const newW = VIEWBOX_W / newZoom;
		const oldH = VIEWBOX_H / zoom;
		const newH = VIEWBOX_H / newZoom;

		panX += (oldW - newW) * cursorX;
		panY += (oldH - newH) * cursorY;
		zoom = newZoom;
	}

	function handlePointerDown(e: PointerEvent) {
		if (e.button !== 0) return;
		isPanning = true;
		didPan = false;
		panStartX = e.clientX;
		panStartY = e.clientY;
		panStartPanX = panX;
		panStartPanY = panY;
	}

	function handlePointerMove(e: PointerEvent) {
		if (!isPanning || !svgEl) return;
		const dx = e.clientX - panStartX;
		const dy = e.clientY - panStartY;
		if (!didPan && Math.abs(dx) < PAN_THRESHOLD && Math.abs(dy) < PAN_THRESHOLD) return;
		didPan = true;
		const rect = svgEl.getBoundingClientRect();
		panX = panStartPanX - (dx / rect.width) * (VIEWBOX_W / zoom);
		panY = panStartPanY - (dy / rect.height) * (VIEWBOX_H / zoom);
	}

	function handlePointerUp() {
		isPanning = false;
	}

	function resetZoom() {
		zoom = 1;
		panX = 0;
		panY = 0;
	}

	function zoomIn() {
		const newZoom = Math.min(zoom * 1.3, MAX_ZOOM);
		const oldW = VIEWBOX_W / zoom;
		const newW = VIEWBOX_W / newZoom;
		const oldH = VIEWBOX_H / zoom;
		const newH = VIEWBOX_H / newZoom;
		panX += (oldW - newW) / 2;
		panY += (oldH - newH) / 2;
		zoom = newZoom;
	}

	function zoomOut() {
		const newZoom = Math.max(zoom * 0.7, MIN_ZOOM);
		const oldW = VIEWBOX_W / zoom;
		const newW = VIEWBOX_W / newZoom;
		const oldH = VIEWBOX_H / zoom;
		const newH = VIEWBOX_H / newZoom;
		panX += (oldW - newW) / 2;
		panY += (oldH - newH) / 2;
		zoom = newZoom;
	}
</script>

<div class="graph-container">
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<svg
		bind:this={svgEl}
		viewBox={viewBox}
		class="pipeline-graph"
		class:graph-panning={isPanning && didPan}
		aria-label="RAG pipeline visualization"
		onwheel={handleWheel}
		onpointerdown={handlePointerDown}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerUp}
		onpointercancel={handlePointerUp}
		ondblclick={resetZoom}
	>
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

	<!-- Zoom controls -->
	<div class="zoom-controls">
		<button class="zoom-btn" onclick={zoomIn} aria-label="Zoom in" title="Zoom in">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
			</svg>
		</button>
		<button class="zoom-btn" onclick={zoomOut} aria-label="Zoom out" title="Zoom out">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<line x1="5" y1="12" x2="19" y2="12" />
			</svg>
		</button>
		{#if isZoomed}
			<button class="zoom-btn" onclick={resetZoom} aria-label="Reset zoom" title="Reset zoom (double-click)">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
				</svg>
			</button>
		{/if}
	</div>
</div>

<style>
	.graph-container {
		position: relative;
		width: 100%;
		height: 400px;
	}

	.pipeline-graph {
		width: 100%;
		height: 100%;
		display: block;
		cursor: grab;
		touch-action: none;
	}

	.pipeline-graph.graph-panning {
		cursor: grabbing;
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

	.zoom-controls {
		position: absolute;
		bottom: var(--spacing-2);
		right: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		background: color-mix(in srgb, var(--color-surface-2) 85%, transparent);
		backdrop-filter: blur(8px);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: 2px;
	}

	.zoom-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		color: var(--color-muted);
		transition: color 120ms, background 120ms;
	}

	.zoom-btn:hover {
		color: var(--color-fg);
		background: color-mix(in srgb, var(--color-muted) 12%, transparent);
	}
</style>
