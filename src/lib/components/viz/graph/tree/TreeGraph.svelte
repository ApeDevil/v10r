<script lang="ts">
import type { HierarchyPointLink, HierarchyPointNode } from 'd3-hierarchy';
import { onDestroy, onMount } from 'svelte';
import { beforeNavigate } from '$app/navigation';
import { cn } from '$lib/utils/cn';
import type { ChartContainerVariants } from '../../_shared/chart-container';
import { getVizPalette } from '../../_shared/theme-bridge';
import SvgGraphContainer from '../_shared/SvgGraphContainer.svelte';
import type { TreeData } from './types';

interface Props {
	data: TreeData;
	orientation?: 'horizontal' | 'vertical';
	aspect?: ChartContainerVariants['aspect'];
	ariaLabel?: string;
	class?: string;
}

let {
	data,
	orientation = 'horizontal',
	aspect = 'chart',
	ariaLabel = 'Tree diagram',
	class: className,
}: Props = $props();

type PointNode = HierarchyPointNode<TreeData> & { _collapsed?: boolean };

let layoutNodes = $state<PointNode[]>([]);
let layoutLinks = $state<HierarchyPointLink<TreeData>[]>([]);
let collapsedIds = $state<Set<string>>(new Set());
let selectedNodeId = $state<string | null>(null);
let focusedNodeIdx = $state(-1);
let palette: string[] = [];
let d3HierarchyModule: typeof import('d3-hierarchy') | undefined;

function cleanup() {
	// No simulation to stop, but reset state for clean teardown
	d3HierarchyModule = undefined;
}

beforeNavigate(cleanup);
onDestroy(cleanup);

onMount(async () => {
	palette = getVizPalette();
	d3HierarchyModule = await import('d3-hierarchy');
	computeLayout(d3HierarchyModule);
});

function computeLayout(d3Hierarchy: typeof import('d3-hierarchy')) {
	// Filter out collapsed children
	function filterCollapsed(node: TreeData): TreeData {
		if (collapsedIds.has(node.id) || !node.children) {
			return { id: node.id, label: node.label };
		}
		return {
			...node,
			children: node.children.map(filterCollapsed),
		};
	}

	const filteredData = filterCollapsed(data);
	const root = d3Hierarchy.hierarchy(filteredData);
	const treeLayout = d3Hierarchy.tree<TreeData>().nodeSize([40, 160]);
	treeLayout(root);

	layoutNodes = root.descendants() as PointNode[];
	// After tree() layout, nodes have x/y so links are effectively HierarchyPointLink
	layoutLinks = root.links() as unknown as HierarchyPointLink<TreeData>[];
}

// Recompute when data or collapsed state changes (cached module ref)
$effect(() => {
	const _data = data;
	const _collapsed = collapsedIds;
	if (d3HierarchyModule) {
		computeLayout(d3HierarchyModule);
	}
});

function toggleCollapse(nodeId: string) {
	const next = new Set(collapsedIds);
	if (next.has(nodeId)) {
		next.delete(nodeId);
	} else {
		next.add(nodeId);
	}
	collapsedIds = next;
}

function hasChildren(nodeId: string): boolean {
	// Check original data, not filtered
	function find(node: TreeData): TreeData | undefined {
		if (node.id === nodeId) return node;
		return node.children?.map(find).find(Boolean);
	}
	const found = find(data);
	return (found?.children?.length ?? 0) > 0;
}

function isCollapsed(nodeId: string): boolean {
	return collapsedIds.has(nodeId);
}

function getNodeColor(depth: number): string {
	return palette[depth % palette.length] || '#3b82f6';
}

/** Get node x/y accounting for orientation swap */
function nodeX(node: PointNode): number {
	return orientation === 'horizontal' ? node.y : node.x;
}

function nodeY(node: PointNode): number {
	return orientation === 'horizontal' ? node.x : node.y;
}

/** SVG path for link between parent and child */
function linkPath(link: HierarchyPointLink<TreeData>): string {
	const sx = orientation === 'horizontal' ? link.source.y : link.source.x;
	const sy = orientation === 'horizontal' ? link.source.x : link.source.y;
	const tx = orientation === 'horizontal' ? link.target.y : link.target.x;
	const ty = orientation === 'horizontal' ? link.target.x : link.target.y;

	// Cubic bezier with control points for smooth curves
	const mx = (sx + tx) / 2;
	if (orientation === 'horizontal') {
		return `M${sx},${sy}C${mx},${sy} ${mx},${ty} ${tx},${ty}`;
	}
	const my = (sy + ty) / 2;
	return `M${sx},${sy}C${sx},${my} ${tx},${my} ${tx},${ty}`;
}

function handleNodeKeydown(event: KeyboardEvent, node: PointNode, idx: number) {
	if (event.key === 'Enter' || event.key === ' ') {
		event.preventDefault();
		if (hasChildren(node.data.id)) {
			toggleCollapse(node.data.id);
		}
		selectedNodeId = selectedNodeId === node.data.id ? null : node.data.id;
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

// Focus management: when focusedNodeIdx changes, focus the corresponding element
$effect(() => {
	if (focusedNodeIdx >= 0 && focusedNodeIdx < layoutNodes.length) {
		const el = document.querySelector(`.tree-graph .tree-node[data-idx="${focusedNodeIdx}"]`) as HTMLElement | null;
		el?.focus();
	}
});

let announcement = $derived.by(() => {
	if (selectedNodeId) {
		const node = layoutNodes.find((n) => n.data.id === selectedNodeId);
		if (!node) return '';
		const childCount = node.children?.length ?? 0;
		const collapsedState = hasChildren(node.data.id) ? (isCollapsed(node.data.id) ? ', collapsed' : ', expanded') : '';
		return `Selected ${node.data.label || node.data.id}, depth ${node.depth}, ${childCount} children${collapsedState}`;
	}
	return '';
});
</script>

<SvgGraphContainer {aspect} {ariaLabel} class={cn('tree-graph', className)}>
	{#snippet skeleton()}
		<svg viewBox="0 0 400 300" class="skeleton-svg" aria-hidden="true">
			<!-- Root → level 1 -->
			<line x1="60" y1="150" x2="160" y2="80" class="skeleton-edge" />
			<line x1="60" y1="150" x2="160" y2="150" class="skeleton-edge" />
			<line x1="60" y1="150" x2="160" y2="220" class="skeleton-edge" />
			<!-- Level 1 → level 2 -->
			<line x1="160" y1="80" x2="280" y2="50" class="skeleton-edge" />
			<line x1="160" y1="80" x2="280" y2="110" class="skeleton-edge" />
			<line x1="160" y1="220" x2="280" y2="200" class="skeleton-edge" />
			<line x1="160" y1="220" x2="280" y2="250" class="skeleton-edge" />
			<!-- Nodes -->
			<rect x="40" y="138" width="40" height="24" rx="4" class="skeleton-node pulse-1" />
			<rect x="140" y="68" width="40" height="24" rx="4" class="skeleton-node pulse-2" />
			<rect x="140" y="138" width="40" height="24" rx="4" class="skeleton-node pulse-3" />
			<rect x="140" y="208" width="40" height="24" rx="4" class="skeleton-node pulse-4" />
			<rect x="260" y="38" width="40" height="24" rx="4" class="skeleton-node pulse-1" />
			<rect x="260" y="98" width="40" height="24" rx="4" class="skeleton-node pulse-2" />
			<rect x="260" y="188" width="40" height="24" rx="4" class="skeleton-node pulse-3" />
			<rect x="260" y="238" width="40" height="24" rx="4" class="skeleton-node pulse-4" />
		</svg>
	{/snippet}

	{#snippet children({ width: w, height: h })}
		{@const xs = layoutNodes.map(nodeX)}
		{@const ys = layoutNodes.map(nodeY)}
		{@const cx = xs.length > 0 ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0}
		{@const cy = ys.length > 0 ? (Math.min(...ys) + Math.max(...ys)) / 2 : 0}
		<g transform="translate({w / 2 - cx},{h / 2 - cy})">
			<!-- Links -->
			{#each layoutLinks as link}
				<path
					d={linkPath(link)}
					class="tree-link"
				/>
			{/each}

			<!-- Nodes -->
			{#each layoutNodes as node, idx}
				<g
					class="tree-node"
					data-idx={idx}
					transform="translate({nodeX(node)},{nodeY(node)})"
					tabindex="0"
					role="button"
					aria-label="{node.data.label || node.data.id}, depth {node.depth}{hasChildren(node.data.id) ? (isCollapsed(node.data.id) ? ', collapsed' : ', expanded') : ''}"
					onclick={() => {
						if (hasChildren(node.data.id)) {
							toggleCollapse(node.data.id);
						}
						selectedNodeId = selectedNodeId === node.data.id ? null : node.data.id;
					}}
					onkeydown={(e) => handleNodeKeydown(e, node, idx)}
				>
					<rect
						x="-40"
						y="-14"
						width="80"
						height="28"
						rx="6"
						fill={getNodeColor(node.depth)}
						class="node-rect"
						class:selected={selectedNodeId === node.data.id}
					/>
					<text class="node-text">
						{node.data.label || node.data.id}
					</text>

					<!-- Collapse/expand indicator for nodes with children -->
					{#if hasChildren(node.data.id)}
						<circle
							cx="44"
							cy="0"
							r="8"
							class="collapse-indicator"
						/>
						<text x="44" y="1" class="collapse-icon">
							{isCollapsed(node.data.id) ? '+' : '\u2212'}
						</text>
					{/if}
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

	.tree-link {
		fill: none;
		stroke: var(--chart-axis);
		stroke-width: 1.5;
		stroke-opacity: 0.5;
	}

	.tree-node {
		cursor: pointer;
		outline: none;
	}

	.tree-node:focus-visible .node-rect {
		stroke: var(--color-primary);
		stroke-width: 3;
		stroke-dasharray: 4 2;
	}

	.node-rect {
		stroke: var(--surface-1);
		stroke-width: 2;
		opacity: 0.9;
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

	.collapse-indicator {
		fill: var(--surface-1);
		stroke: var(--chart-axis);
		stroke-width: 1.5;
	}

	.collapse-icon {
		text-anchor: middle;
		dominant-baseline: central;
		font-size: 12px;
		fill: var(--chart-axis);
		pointer-events: none;
		font-weight: 700;
	}
</style>
