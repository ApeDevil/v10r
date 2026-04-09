<script lang="ts">
import { onDestroy, onMount } from 'svelte';
import { beforeNavigate } from '$app/navigation';
import { cn } from '$lib/utils/cn';
import type { ChartContainerVariants } from '../../_shared/chart-container';
import { getVizPalette } from '../../_shared/theme-bridge';
import SvgGraphContainer from '../_shared/SvgGraphContainer.svelte';
import { arrowMarker } from '../_shared/svg-markers';
import type { DagData, DagNode as DagNodeType } from './types';

interface Props {
	data: DagData;
	orientation?: 'horizontal' | 'vertical';
	aspect?: ChartContainerVariants['aspect'];
	ariaLabel?: string;
	class?: string;
}

let {
	data,
	orientation = 'horizontal',
	aspect = 'chart',
	ariaLabel = 'DAG diagram',
	class: className,
}: Props = $props();

interface LayoutNode {
	id: string;
	label?: string;
	group?: string;
	x: number;
	y: number;
	layer: number;
}

interface LayoutLink {
	sourceId: string;
	targetId: string;
	points: Array<{ x: number; y: number }>;
}

let layoutNodes = $state<LayoutNode[]>([]);
let layoutLinks = $state<LayoutLink[]>([]);
let selectedNodeId = $state<string | null>(null);
let focusedNodeIdx = $state(-1);
let palette: string[] = [];
let d3DagModule: typeof import('d3-dag') | undefined;

function cleanup() {
	d3DagModule = undefined;
}

beforeNavigate(cleanup);
onDestroy(cleanup);

onMount(async () => {
	palette = getVizPalette();
	d3DagModule = await import('d3-dag');
	computeLayout();
});

function computeLayout() {
	if (!d3DagModule) return;

	if (data.edges.length === 0) {
		layoutNodes = data.nodes.map((n, i) => ({
			id: n.id,
			label: n.label,
			group: n.group,
			x: i * 160,
			y: 0,
			layer: 0,
		}));
		layoutLinks = [];
		return;
	}

	try {
		const nodeMap = new Map(data.nodes.map((n) => [n.id, n]));

		// graphConnect creates DAG from edge pairs
		const edgePairs: [string, string][] = data.edges.map((e) => [e.source, e.target]);
		const dag = d3DagModule.graphConnect()(edgePairs);

		// Sugiyama layout — produces top-to-bottom coordinates
		const layout = d3DagModule.sugiyama().nodeSize([80, 40]).gap([40, 80]);
		layout(dag);

		const nodes: LayoutNode[] = [];
		// Collect raw positions first to derive actual layers
		const rawNodes: Array<{ id: string; nodeData: DagNodeType | undefined; x: number; y: number; layerCoord: number }> =
			[];
		for (const node of dag.nodes()) {
			const id = node.data as string;
			const nodeData = nodeMap.get(id);
			const isHorizontal = orientation === 'horizontal';
			rawNodes.push({
				id,
				nodeData,
				x: isHorizontal ? node.y : node.x,
				y: isHorizontal ? node.x : node.y,
				// Sugiyama Y is always the layer/depth axis
				layerCoord: node.y,
			});
		}
		// Map unique layer coordinates to layer indices
		const uniqueLayers = [...new Set(rawNodes.map((n) => n.layerCoord))].sort((a, b) => a - b);
		const layerMap = new Map(uniqueLayers.map((coord, idx) => [coord, idx]));
		for (const raw of rawNodes) {
			nodes.push({
				id: raw.id,
				label: raw.nodeData?.label ?? raw.id,
				group: raw.nodeData?.group,
				x: raw.x,
				y: raw.y,
				layer: layerMap.get(raw.layerCoord) ?? 0,
			});
		}

		const links: LayoutLink[] = [];
		for (const link of dag.links()) {
			const isHorizontal = orientation === 'horizontal';
			const points = link.points.map((p: [number, number]) => ({
				x: isHorizontal ? p[1] : p[0],
				y: isHorizontal ? p[0] : p[1],
			}));
			links.push({
				sourceId: link.source.data as string,
				targetId: link.target.data as string,
				points,
			});
		}

		layoutNodes = nodes;
		layoutLinks = links;
	} catch {
		// Fallback: arrange nodes in a line
		layoutNodes = data.nodes.map((n, i) => ({
			id: n.id,
			label: n.label,
			group: n.group,
			x: i * 160,
			y: 0,
			layer: 0,
		}));
		layoutLinks = [];
	}
}

// Recompute when data or orientation changes
// svelte-ignore state_referenced_locally
$effect(() => {
	const _data = data;
	const _orientation = orientation;
	if (d3DagModule) {
		computeLayout();
	}
});

function getNodeColor(node: LayoutNode): string {
	return palette[node.layer % palette.length] || '#3b82f6';
}

function linkPath(link: LayoutLink): string {
	const pts = link.points;
	if (pts.length < 2) return '';

	const [first, ...rest] = pts;
	if (rest.length === 1) {
		// Direct: cubic bezier
		const last = rest[0];
		if (orientation === 'horizontal') {
			const mx = (first.x + last.x) / 2;
			return `M${first.x},${first.y}C${mx},${first.y} ${mx},${last.y} ${last.x},${last.y}`;
		}
		const my = (first.y + last.y) / 2;
		return `M${first.x},${first.y}C${first.x},${my} ${last.x},${my} ${last.x},${last.y}`;
	}

	// Multi-point: polyline
	let d = `M${first.x},${first.y}`;
	for (const p of rest) {
		d += ` L${p.x},${p.y}`;
	}
	return d;
}

function getEdgeOpacity(link: LayoutLink): number {
	if (!selectedNodeId) return 0.5;
	if (link.sourceId === selectedNodeId || link.targetId === selectedNodeId) return 0.8;
	return 0.1;
}

function getNodeOpacity(node: LayoutNode): number {
	if (!selectedNodeId) return 0.9;
	if (selectedNodeId === node.id) return 1;
	const connected = layoutLinks.some(
		(l) =>
			(l.sourceId === selectedNodeId && l.targetId === node.id) ||
			(l.targetId === selectedNodeId && l.sourceId === node.id),
	);
	return connected ? 0.8 : 0.2;
}

function handleNodeKeydown(event: KeyboardEvent, node: LayoutNode, idx: number) {
	if (event.key === 'Enter' || event.key === ' ') {
		event.preventDefault();
		selectedNodeId = selectedNodeId === node.id ? null : node.id;
	} else if (event.key === 'Escape') {
		event.preventDefault();
		selectedNodeId = null;
	} else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
		event.preventDefault();
		focusedNodeIdx = (idx + 1) % layoutNodes.length;
	} else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
		event.preventDefault();
		focusedNodeIdx = (idx - 1 + layoutNodes.length) % layoutNodes.length;
	}
}

$effect(() => {
	if (focusedNodeIdx >= 0 && focusedNodeIdx < layoutNodes.length) {
		const el = document.querySelector(`.dag-graph .dag-node[data-idx="${focusedNodeIdx}"]`) as HTMLElement | null;
		el?.focus();
	}
});

let announcement = $derived.by(() => {
	if (selectedNodeId) {
		const node = layoutNodes.find((n) => n.id === selectedNodeId);
		if (!node) return '';
		const upstream = layoutLinks.filter((l) => l.targetId === node.id).length;
		const downstream = layoutLinks.filter((l) => l.sourceId === node.id).length;
		return `Selected ${node.label || node.id}${node.group ? `, ${node.group}` : ''}, ${upstream} upstream, ${downstream} downstream`;
	}
	return '';
});
</script>

<SvgGraphContainer {aspect} {ariaLabel} class={cn('dag-graph', className)}>
	{#snippet skeleton()}
		<svg viewBox="0 0 400 300" class="skeleton-svg" aria-hidden="true">
			<!-- Top layer -->
			<rect x="30" y="40" width="60" height="24" rx="4" class="skeleton-node pulse-1" />
			<rect x="130" y="40" width="60" height="24" rx="4" class="skeleton-node pulse-2" />
			<!-- Middle layer -->
			<rect x="80" y="130" width="60" height="24" rx="4" class="skeleton-node pulse-3" />
			<rect x="200" y="130" width="60" height="24" rx="4" class="skeleton-node pulse-4" />
			<rect x="280" y="130" width="60" height="24" rx="4" class="skeleton-node pulse-1" />
			<!-- Bottom layer -->
			<rect x="160" y="220" width="60" height="24" rx="4" class="skeleton-node pulse-2" />
			<rect x="260" y="220" width="60" height="24" rx="4" class="skeleton-node pulse-3" />
			<!-- Edges -->
			<line x1="60" y1="64" x2="110" y2="130" class="skeleton-edge" />
			<line x1="60" y1="64" x2="230" y2="130" class="skeleton-edge" />
			<line x1="160" y1="64" x2="230" y2="130" class="skeleton-edge" />
			<line x1="160" y1="64" x2="310" y2="130" class="skeleton-edge" />
			<line x1="110" y1="154" x2="190" y2="220" class="skeleton-edge" />
			<line x1="230" y1="154" x2="190" y2="220" class="skeleton-edge" />
			<line x1="310" y1="154" x2="290" y2="220" class="skeleton-edge" />
		</svg>
	{/snippet}

	{#snippet children({ width: w, height: h })}
		<defs>
			<!-- DAG-specific arrow: refX accounts for 80×28 rectangular nodes -->
			<marker
				id="dag-arrow"
				viewBox={arrowMarker.viewBox}
				refX="55"
				refY={arrowMarker.refY}
				markerWidth={arrowMarker.markerWidth}
				markerHeight={arrowMarker.markerHeight}
				orient="auto"
			>
				<path d={arrowMarker.path} class="arrow-fill" />
			</marker>
		</defs>

		{@const xs = layoutNodes.map((n) => n.x)}
		{@const ys = layoutNodes.map((n) => n.y)}
		{@const cx = xs.length > 0 ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0}
		{@const cy = ys.length > 0 ? (Math.min(...ys) + Math.max(...ys)) / 2 : 0}
		<g transform="translate({w / 2 - cx},{h / 2 - cy})">
			<!-- Links -->
			{#each layoutLinks as link}
				<path
					d={linkPath(link)}
					class="dag-link"
					style:opacity={getEdgeOpacity(link)}
					marker-end="url(#dag-arrow)"
				/>
			{/each}

			<!-- Nodes -->
			{#each layoutNodes as node, idx}
				<g
					class="dag-node"
					data-idx={idx}
					transform="translate({node.x},{node.y})"
					style:opacity={getNodeOpacity(node)}
					tabindex="0"
					role="button"
					aria-label="{node.label || node.id}{node.group ? `, ${node.group}` : ''}"
					onclick={() => (selectedNodeId = selectedNodeId === node.id ? null : node.id)}
					onkeydown={(e) => handleNodeKeydown(e, node, idx)}
				>
					<rect
						x="-40"
						y="-14"
						width="80"
						height="28"
						rx="6"
						fill={getNodeColor(node)}
						class="node-rect"
						class:selected={selectedNodeId === node.id}
					/>
					<text class="node-text">
						{node.label || node.id}
					</text>
				</g>
			{/each}
		</g>
	{/snippet}
</SvgGraphContainer>

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

	.dag-link {
		fill: none;
		stroke: var(--chart-axis);
		stroke-width: 1.5;
		transition: opacity 0.15s ease;
	}

	:global(.arrow-fill) {
		fill: var(--chart-axis);
	}

	.dag-node {
		cursor: pointer;
		outline: none;
	}

	.dag-node:focus-visible .node-rect {
		stroke: var(--color-primary);
		stroke-width: 3;
		stroke-dasharray: 4 2;
	}

	.node-rect {
		stroke: var(--surface-1);
		stroke-width: 2;
		transition: opacity 0.15s ease;
	}

	.node-rect:hover {
		opacity: 1;
	}

	.node-rect.selected {
		stroke: var(--color-fg);
		stroke-width: 3;
	}

	.node-text {
		text-anchor: middle;
		dominant-baseline: central;
		font-size: 11px;
		fill: white;
		pointer-events: none;
		user-select: none;
		font-weight: 500;
	}
</style>
