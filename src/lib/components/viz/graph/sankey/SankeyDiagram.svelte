<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { cn } from '$lib/utils/cn';
	import SvgGraphContainer from '../_shared/SvgGraphContainer.svelte';
	import { getVizPalette } from '../../_shared/theme-bridge';
	import type { ChartContainerVariants } from '../../_shared/chart-container';
	import type { SankeyData, SankeyNodeData, SankeyLinkData } from './types';

	interface Props {
		data: SankeyData;
		aspect?: ChartContainerVariants['aspect'];
		ariaLabel?: string;
		class?: string;
	}

	let {
		data,
		aspect = 'chart',
		ariaLabel = 'Sankey diagram',
		class: className,
	}: Props = $props();

	// Layout output types (after d3-sankey mutates data)
	interface LayoutNode {
		id: string;
		label?: string;
		category?: string;
		x0: number;
		x1: number;
		y0: number;
		y1: number;
		value: number;
		index: number;
	}

	interface LayoutLink {
		source: LayoutNode;
		target: LayoutNode;
		value: number;
		width: number;
		y0: number;
		y1: number;
	}

	let layoutNodes = $state<LayoutNode[]>([]);
	let layoutLinks = $state<LayoutLink[]>([]);
	let selectedNodeId = $state<string | null>(null);
	let hoveredNodeId = $state<string | null>(null);
	let focusedNodeIdx = $state(-1);
	let palette: string[] = [];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let d3SankeyModule: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let linkPathGenerator: any;
	let layoutWidth = 600;
	let layoutHeight = 400;

	function cleanup() {
		d3SankeyModule = undefined;
		linkPathGenerator = undefined;
	}

	beforeNavigate(cleanup);
	onDestroy(cleanup);

	onMount(async () => {
		palette = getVizPalette();
		d3SankeyModule = await import('d3-sankey');
		linkPathGenerator = d3SankeyModule.sankeyLinkHorizontal();
		computeLayout();
	});

	function computeLayout(w = 600, h = 400) {
		if (!d3SankeyModule) return;

		layoutWidth = w;
		layoutHeight = h;

		try {
			// Clone data — d3-sankey mutates input
			const sankeyNodes = data.nodes.map((n) => ({ ...n }));
			const sankeyLinks = data.edges.map((e) => ({
				source: e.source,
				target: e.target,
				value: e.value,
			}));

			const sankeyGenerator = d3SankeyModule
				.sankey()
				.nodeWidth(26)
				.nodePadding(16)
				.extent([
					[40, 20],
					[w - 40, h - 20],
				])
				.nodeId((d: SankeyNodeData) => d.id);

			const graph = sankeyGenerator({ nodes: sankeyNodes, links: sankeyLinks });

			layoutNodes = graph.nodes as LayoutNode[];
			layoutLinks = graph.links as LayoutLink[];
		} catch {
			layoutNodes = [];
			layoutLinks = [];
		}
	}

	// Recompute when data changes
	$effect(() => {
		const _data = data;
		if (d3SankeyModule) {
			computeLayout(layoutWidth, layoutHeight);
		}
	});

	function getNodeColor(node: LayoutNode, idx: number): string {
		return palette[idx % palette.length] || '#3b82f6';
	}

	function getLinkPath(link: LayoutLink): string {
		if (!linkPathGenerator) return '';
		return linkPathGenerator(link) ?? '';
	}

	function getLinkOpacity(link: LayoutLink): number {
		const srcId = typeof link.source === 'object' ? link.source.id : link.source;
		const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
		if (selectedNodeId && srcId !== selectedNodeId && tgtId !== selectedNodeId) return 0.08;
		if (hoveredNodeId && srcId !== hoveredNodeId && tgtId !== hoveredNodeId) return 0.15;
		return 0.4;
	}

	function getNodeOpacity(node: LayoutNode): number {
		if (!selectedNodeId && !hoveredNodeId) return 1;
		if (selectedNodeId === node.id || hoveredNodeId === node.id) return 1;
		const connected = layoutLinks.some((l) => {
			const srcId = typeof l.source === 'object' ? l.source.id : l.source;
			const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
			const focus = selectedNodeId || hoveredNodeId;
			return srcId === focus && tgtId === node.id || tgtId === focus && srcId === node.id;
		});
		return connected ? 0.8 : 0.2;
	}

	function nodeHeight(node: LayoutNode): number {
		return Math.max(node.y1 - node.y0, 1);
	}

	function shouldShowLabel(node: LayoutNode): boolean {
		return nodeHeight(node) > 20;
	}

	function formatValue(val: number): string {
		if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
		if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
		return String(val);
	}

	function handleNodeKeydown(event: KeyboardEvent, node: LayoutNode, idx: number) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			selectedNodeId = selectedNodeId === node.id ? null : node.id;
		} else if (event.key === 'Escape') {
			event.preventDefault();
			selectedNodeId = null;
			hoveredNodeId = null;
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
			const el = document.querySelector(
				`.sankey-diagram .sankey-node[data-idx="${focusedNodeIdx}"]`,
			) as HTMLElement | null;
			el?.focus();
		}
	});

	let announcement = $derived.by(() => {
		if (selectedNodeId) {
			const node = layoutNodes.find((n) => n.id === selectedNodeId);
			if (!node) return '';
			const inflows = layoutLinks.filter((l) => {
				const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
				return tgtId === node.id;
			}).length;
			const outflows = layoutLinks.filter((l) => {
				const srcId = typeof l.source === 'object' ? l.source.id : l.source;
				return srcId === node.id;
			}).length;
			return `Selected ${node.label || node.id}, value ${formatValue(node.value)}, ${inflows} inflows, ${outflows} outflows`;
		}
		return '';
	});
</script>

<SvgGraphContainer {aspect} {ariaLabel} class={cn('sankey-diagram', className)}>
	{#snippet skeleton()}
		<svg viewBox="0 0 400 300" class="skeleton-svg" aria-hidden="true">
			<!-- Source rects -->
			<rect x="30" y="20" width="24" height="100" rx="3" class="skeleton-node pulse-1" />
			<rect x="30" y="140" width="24" height="60" rx="3" class="skeleton-node pulse-2" />
			<rect x="30" y="220" width="24" height="60" rx="3" class="skeleton-node pulse-3" />
			<!-- Target rects -->
			<rect x="346" y="30" width="24" height="80" rx="3" class="skeleton-node pulse-4" />
			<rect x="346" y="130" width="24" height="70" rx="3" class="skeleton-node pulse-1" />
			<rect x="346" y="220" width="24" height="60" rx="3" class="skeleton-node pulse-2" />
			<!-- Flows -->
			<path d="M54,50 C200,50 200,50 346,50" class="skeleton-flow pulse-3" />
			<path d="M54,100 C200,100 200,155 346,155" class="skeleton-flow pulse-4" />
			<path d="M54,170 C200,170 200,240 346,240" class="skeleton-flow pulse-1" />
		</svg>
	{/snippet}

	{#snippet children({ width: w, height: h })}
		<!-- Gradient defs for flows -->
		<defs>
			{#each layoutLinks as link, idx}
				{@const srcId = typeof link.source === 'object' ? link.source.id : link.source}
				{@const tgtId = typeof link.target === 'object' ? link.target.id : link.target}
				{@const srcIdx = layoutNodes.findIndex((n) => n.id === srcId)}
				{@const tgtIdx = layoutNodes.findIndex((n) => n.id === tgtId)}
				<linearGradient id="flow-gradient-{idx}" x1="0%" y1="0%" x2="100%" y2="0%">
					<stop offset="0%" stop-color={getNodeColor(layoutNodes[srcIdx], srcIdx)} />
					<stop offset="100%" stop-color={getNodeColor(layoutNodes[tgtIdx], tgtIdx)} />
				</linearGradient>
			{/each}
		</defs>

		<!-- Flow links -->
		{#each layoutLinks as link, idx}
			<path
				d={getLinkPath(link)}
				class="sankey-link"
				style:opacity={getLinkOpacity(link)}
				stroke="url(#flow-gradient-{idx})"
				stroke-width={Math.max(link.width, 1)}
				fill="none"
			/>
		{/each}

		<!-- Node rects -->
		{#each layoutNodes as node, idx}
			<g
				class="sankey-node"
				data-idx={idx}
				style:opacity={getNodeOpacity(node)}
				tabindex="0"
				role="button"
				aria-label="{node.label || node.id}, value {formatValue(node.value)}"
				onclick={() => (selectedNodeId = selectedNodeId === node.id ? null : node.id)}
				onmouseenter={() => (hoveredNodeId = node.id)}
				onmouseleave={() => (hoveredNodeId = null)}
				onkeydown={(e) => handleNodeKeydown(e, node, idx)}
				onfocus={() => (hoveredNodeId = node.id)}
				onblur={() => (hoveredNodeId = null)}
			>
				<rect
					x={node.x0}
					y={node.y0}
					width={node.x1 - node.x0}
					height={nodeHeight(node)}
					fill={getNodeColor(node, idx)}
					class="node-rect"
					class:selected={selectedNodeId === node.id}
				/>
				{#if shouldShowLabel(node)}
					<text
						x={node.x1 + 8}
						y={(node.y0 + node.y1) / 2}
						class="node-label"
					>
						{node.label || node.id}
					</text>
				{/if}
			</g>
		{/each}
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

	.skeleton-node {
		fill: var(--chart-grid);
	}

	.skeleton-flow {
		fill: none;
		stroke: var(--chart-grid);
		stroke-width: 20;
		stroke-opacity: 0.3;
	}

	.pulse-1 { animation: pulse 1.5s ease-in-out infinite; }
	.pulse-2 { animation: pulse 1.5s ease-in-out 0.15s infinite; }
	.pulse-3 { animation: pulse 1.5s ease-in-out 0.3s infinite; }
	.pulse-4 { animation: pulse 1.5s ease-in-out 0.45s infinite; }

	@keyframes pulse {
		0%, 100% { opacity: 0.3; }
		50% { opacity: 0.6; }
	}

	.sankey-link {
		transition: opacity 0.15s ease;
	}

	.sankey-node {
		cursor: pointer;
		outline: none;
	}

	.sankey-node:focus-visible .node-rect {
		stroke: var(--color-primary);
		stroke-width: 3;
		stroke-dasharray: 4 2;
	}

	.node-rect {
		stroke: var(--surface-1);
		stroke-width: 1;
		transition: opacity 0.15s ease;
	}

	.node-rect:hover {
		opacity: 1;
	}

	.node-rect.selected {
		stroke: var(--color-fg);
		stroke-width: 2;
	}

	.node-label {
		dominant-baseline: central;
		font-size: 11px;
		fill: var(--chart-label);
		pointer-events: none;
		user-select: none;
		font-weight: 500;
	}
</style>
