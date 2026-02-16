<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { cn } from '$lib/utils/cn';
	import SvgGraphContainer from '../_shared/SvgGraphContainer.svelte';
	import { arrowMarker } from '../_shared/svg-markers';
	import { getVizPalette } from '../../_shared/theme-bridge';
	import type { ChartContainerVariants } from '../../_shared/chart-container';
	import type { NetworkData, NetworkNode } from './types';
	import type { Simulation, SimulationNodeDatum } from 'd3-force';

	interface Props {
		data: NetworkData;
		directed?: boolean;
		aspect?: ChartContainerVariants['aspect'];
		ariaLabel?: string;
		class?: string;
	}

	let {
		data,
		directed = false,
		aspect = 'chart',
		ariaLabel = 'Network graph',
		class: className,
	}: Props = $props();

	// Internal simulation nodes with D3-mutated x/y positions
	type SimNode = NetworkNode & SimulationNodeDatum;
	// D3 force mutates source/target from string → node object references
	interface SimEdge {
		source: SimNode | string;
		target: SimNode | string;
		weight?: number;
	}

	let nodes = $state<SimNode[]>([]);
	let edges = $state<SimEdge[]>([]);
	let simulation: Simulation<SimNode, SimEdge> | undefined;
	let d3ForceModule: typeof import('d3-force') | undefined;
	let palette: string[] = [];
	let groups: string[] = [];
	let selectedNodeId = $state<string | null>(null);
	let hoveredNodeId = $state<string | null>(null);
	let focusedNodeIdx = $state(-1);

	// Drag state with tracked cleanup for listener leak prevention
	let dragNode: SimNode | null = null;
	let dragCleanup: (() => void) | null = null;

	function cleanup() {
		simulation?.stop();
		simulation = undefined;
		dragCleanup?.();
		dragCleanup = null;
		dragNode = null;
	}

	beforeNavigate(cleanup);
	onDestroy(cleanup);

	onMount(async () => {
		d3ForceModule = await import('d3-force');
		palette = getVizPalette();

		initSimulation(d3ForceModule);
	});

	function initSimulation(d3Force: typeof import('d3-force')) {
		// Stop previous but keep drag cleanup
		simulation?.stop();
		simulation = undefined;

		// Clone data to avoid mutating props
		const simNodes: SimNode[] = data.nodes.map((n) => ({ ...n }));
		const simEdges: SimEdge[] = data.edges.map((e) => ({ ...e }));

		// Collect unique groups for coloring
		groups = [...new Set(simNodes.map((n) => n.group).filter(Boolean))] as string[];

		simulation = d3Force
			.forceSimulation(simNodes)
			.force(
				'link',
				d3Force
					.forceLink<SimNode, SimEdge>(simEdges)
					.id((d) => d.id)
					.distance(80),
			)
			.force('charge', d3Force.forceManyBody().strength(-200))
			.force('x', d3Force.forceX().strength(0.05))
			.force('y', d3Force.forceY().strength(0.05))
			.on('tick', () => {
				// Trigger Svelte reactivity by reassigning
				nodes = [...simNodes];
				edges = [...simEdges];
			});
	}

	// Re-run simulation when data changes (cached module ref, no re-import)
	$effect(() => {
		const _data = data;
		if (simulation && d3ForceModule) {
			initSimulation(d3ForceModule);
		}
	});

	function getNodeColor(node: SimNode): string {
		if (!node.group || groups.length === 0) return palette[0] || '#3b82f6';
		const idx = groups.indexOf(node.group);
		return palette[idx % palette.length] || '#3b82f6';
	}

	function getNodeRadius(node: SimNode): number {
		return node.size || 6;
	}

	function getEdgeOpacity(edge: SimEdge): number {
		const src = typeof edge.source === 'string' ? edge.source : edge.source.id;
		const tgt = typeof edge.target === 'string' ? edge.target : edge.target.id;
		if (selectedNodeId && src !== selectedNodeId && tgt !== selectedNodeId) return 0.1;
		if (hoveredNodeId && src !== hoveredNodeId && tgt !== hoveredNodeId) return 0.2;
		return 0.6;
	}

	function getNodeOpacity(node: SimNode): number {
		if (!selectedNodeId && !hoveredNodeId) return 1;
		if (selectedNodeId === node.id || hoveredNodeId === node.id) return 1;
		// Show connected nodes
		const connected = edges.some((e) => {
			const src = typeof e.source === 'string' ? e.source : e.source.id;
			const tgt = typeof e.target === 'string' ? e.target : e.target.id;
			const focus = selectedNodeId || hoveredNodeId;
			return (src === focus && tgt === node.id) || (tgt === focus && src === node.id);
		});
		return connected ? 0.8 : 0.2;
	}

	function edgeX1(e: SimEdge): number {
		return typeof e.source === 'string' ? 0 : (e.source.x ?? 0);
	}
	function edgeY1(e: SimEdge): number {
		return typeof e.source === 'string' ? 0 : (e.source.y ?? 0);
	}
	function edgeX2(e: SimEdge): number {
		return typeof e.target === 'string' ? 0 : (e.target.x ?? 0);
	}
	function edgeY2(e: SimEdge): number {
		return typeof e.target === 'string' ? 0 : (e.target.y ?? 0);
	}

	function handleNodeMousedown(event: MouseEvent, node: SimNode) {
		if (event.button !== 0) return;
		event.stopPropagation();

		// Clean up previous drag if exists
		dragCleanup?.();

		dragNode = node;
		simulation?.alphaTarget(0.3).restart();

		// Capture SVG and zoom group at mousedown time (not stale event ref)
		const svgEl = (event.target as Element).closest('svg') as SVGSVGElement | null;
		if (!svgEl) return;
		// The zoom group is the direct child <g> of the SVG — its CTM includes zoom transform
		const zoomGroup = svgEl.querySelector(':scope > g') as SVGGraphicsElement | null;

		const handleMousemove = (e: MouseEvent) => {
			if (!dragNode) return;
			const ctmTarget = zoomGroup || svgEl;
			const pt = svgEl.createSVGPoint();
			pt.x = e.clientX;
			pt.y = e.clientY;
			const svgP = pt.matrixTransform(ctmTarget.getScreenCTM()?.inverse());
			dragNode.fx = svgP.x;
			dragNode.fy = svgP.y;
		};

		const handleMouseup = () => {
			if (dragNode) {
				dragNode.fx = null;
				dragNode.fy = null;
				dragNode = null;
			}
			simulation?.alphaTarget(0);
			window.removeEventListener('mousemove', handleMousemove);
			window.removeEventListener('mouseup', handleMouseup);
			dragCleanup = null;
		};

		window.addEventListener('mousemove', handleMousemove);
		window.addEventListener('mouseup', handleMouseup);

		// Track for cleanup on navigation/destroy
		dragCleanup = () => {
			window.removeEventListener('mousemove', handleMousemove);
			window.removeEventListener('mouseup', handleMouseup);
		};
	}

	function handleNodeKeydown(event: KeyboardEvent, node: SimNode, idx: number) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			selectedNodeId = selectedNodeId === node.id ? null : node.id;
		} else if (event.key === 'Escape') {
			event.preventDefault();
			selectedNodeId = null;
			hoveredNodeId = null;
		} else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
			event.preventDefault();
			focusedNodeIdx = (idx + 1) % nodes.length;
		} else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
			event.preventDefault();
			focusedNodeIdx = (idx - 1 + nodes.length) % nodes.length;
		}
	}

	// Focus management: when focusedNodeIdx changes, focus the corresponding element
	$effect(() => {
		if (focusedNodeIdx >= 0 && focusedNodeIdx < nodes.length) {
			const el = document.querySelector(
				`.network-graph .graph-node[data-idx="${focusedNodeIdx}"]`,
			) as HTMLElement | null;
			el?.focus();
		}
	});

	// Announcement for screen readers
	let announcement = $derived.by(() => {
		if (selectedNodeId) {
			const node = nodes.find((n) => n.id === selectedNodeId);
			if (!node) return '';
			const connections = edges.filter((e) => {
				const src = typeof e.source === 'string' ? e.source : e.source.id;
				const tgt = typeof e.target === 'string' ? e.target : e.target.id;
				return src === node.id || tgt === node.id;
			}).length;
			return `Selected ${node.label || node.id}${node.group ? `, ${node.group}` : ''}, ${connections} connections`;
		}
		return '';
	});
</script>

<SvgGraphContainer {aspect} {ariaLabel} class={cn('network-graph', className)}>
	{#snippet skeleton()}
		<svg viewBox="0 0 400 300" class="skeleton-svg" aria-hidden="true">
			<line x1="120" y1="80" x2="200" y2="150" class="skeleton-edge" />
			<line x1="200" y1="150" x2="280" y2="80" class="skeleton-edge" />
			<line x1="200" y1="150" x2="160" y2="240" class="skeleton-edge" />
			<line x1="200" y1="150" x2="300" y2="200" class="skeleton-edge" />
			<line x1="280" y1="80" x2="340" y2="150" class="skeleton-edge" />
			<line x1="120" y1="80" x2="60" y2="150" class="skeleton-edge" />
			<circle cx="120" cy="80" r="12" class="skeleton-node pulse-1" />
			<circle cx="200" cy="150" r="14" class="skeleton-node pulse-2" />
			<circle cx="280" cy="80" r="10" class="skeleton-node pulse-3" />
			<circle cx="160" cy="240" r="10" class="skeleton-node pulse-4" />
			<circle cx="300" cy="200" r="10" class="skeleton-node pulse-1" />
			<circle cx="340" cy="150" r="8" class="skeleton-node pulse-2" />
			<circle cx="60" cy="150" r="8" class="skeleton-node pulse-3" />
		</svg>
	{/snippet}

	{#snippet children({ width: w, height: h })}
		<g transform="translate({w / 2},{h / 2})">
		{#if directed}
			<defs>
				<marker
					id={arrowMarker.id}
					viewBox={arrowMarker.viewBox}
					refX={arrowMarker.refX}
					refY={arrowMarker.refY}
					markerWidth={arrowMarker.markerWidth}
					markerHeight={arrowMarker.markerHeight}
					orient="auto"
				>
					<path d={arrowMarker.path} class="arrow-fill" />
				</marker>
			</defs>
		{/if}

		<!-- Edges -->
		{#each edges as edge}
			<line
				x1={edgeX1(edge)}
				y1={edgeY1(edge)}
				x2={edgeX2(edge)}
				y2={edgeY2(edge)}
				class="graph-edge"
				style:opacity={getEdgeOpacity(edge)}
				marker-end={directed ? `url(#${arrowMarker.id})` : undefined}
			/>
		{/each}

		<!-- Nodes -->
		{#each nodes as node, idx}
			<g
				class="graph-node"
				data-idx={idx}
				style:opacity={getNodeOpacity(node)}
				tabindex="0"
				role="button"
				aria-label="{node.label || node.id}{node.group ? `, ${node.group}` : ''}"
				onmousedown={(e) => handleNodeMousedown(e, node)}
				onmouseenter={() => (hoveredNodeId = node.id)}
				onmouseleave={() => (hoveredNodeId = null)}
				onclick={() => (selectedNodeId = selectedNodeId === node.id ? null : node.id)}
				onkeydown={(e) => handleNodeKeydown(e, node, idx)}
				onfocus={() => (hoveredNodeId = node.id)}
				onblur={() => (hoveredNodeId = null)}
			>
				<circle
					cx={node.x ?? 0}
					cy={node.y ?? 0}
					r={getNodeRadius(node)}
					fill={getNodeColor(node)}
					class="node-circle"
					class:selected={selectedNodeId === node.id}
				/>
				{#if node.label}
					<text
						x={node.x ?? 0}
						y={(node.y ?? 0) + getNodeRadius(node) + 14}
						class="node-label"
					>
						{node.label}
					</text>
				{/if}
			</g>
		{/each}
		</g>
	{/snippet}
</SvgGraphContainer>

<!-- Screen reader announcement -->
<div class="sr-only" aria-live="polite" aria-atomic="true">
	{announcement}
</div>

<style>
	.skeleton-svg {
		width: 100%;
		height: 100%;
		max-height: 300px;
	}

	.skeleton-edge {
		stroke: var(--chart-grid);
		stroke-width: 1.5;
	}

	.skeleton-node {
		fill: var(--chart-grid);
	}

	.pulse-1 { animation: pulse 1.5s ease-in-out infinite; }
	.pulse-2 { animation: pulse 1.5s ease-in-out 0.15s infinite; }
	.pulse-3 { animation: pulse 1.5s ease-in-out 0.3s infinite; }
	.pulse-4 { animation: pulse 1.5s ease-in-out 0.45s infinite; }

	@keyframes pulse {
		0%, 100% { opacity: 0.3; }
		50% { opacity: 0.6; }
	}

	.graph-edge {
		stroke: var(--chart-axis);
		stroke-width: 1.5;
		transition: opacity 0.15s ease;
	}

	:global(.arrow-fill) {
		fill: var(--chart-axis);
	}

	.graph-node {
		cursor: grab;
		outline: none;
	}

	.graph-node:active {
		cursor: grabbing;
	}

	.graph-node:focus-visible .node-circle {
		stroke: var(--color-primary);
		stroke-width: 3;
		stroke-dasharray: 4 2;
	}

	.node-circle {
		stroke: var(--surface-1);
		stroke-width: 2;
		transition: opacity 0.15s ease;
	}

	.node-circle.selected {
		stroke: var(--color-fg);
		stroke-width: 3;
	}

	.node-label {
		text-anchor: middle;
		font-size: 11px;
		fill: var(--chart-label);
		pointer-events: none;
		user-select: none;
	}
</style>
