<script lang="ts">
import type { HierarchyRectangularNode } from 'd3-hierarchy';
import { onDestroy, onMount } from 'svelte';
import { beforeNavigate } from '$app/navigation';
import { cn } from '$lib/utils/cn';
import { type ChartContainerVariants, chartContainerVariants } from '../../_shared/chart-container';
import { getVizPalette } from '../../_shared/theme-bridge';
import type { TreemapNode } from './types';

interface Props {
	data: TreemapNode;
	aspect?: ChartContainerVariants['aspect'];
	ariaLabel?: string;
	formatValue?: (value: number) => string;
	class?: string;
}

let {
	data,
	aspect = 'chart',
	ariaLabel = 'Treemap',
	formatValue = (v: number) => v.toLocaleString(),
	class: className,
}: Props = $props();

let containerEl: HTMLDivElement | undefined = $state();
let width = $state(600);
let height = $state(400);
let ready = $state(false);
let palette: string[] = [];
let d3Mod: typeof import('d3-hierarchy') | undefined;
let resizeObserver: ResizeObserver | undefined;

let zoomStack = $state<TreemapNode[]>([]);
let hoveredId = $state<string | null>(null);

const currentRoot = $derived(zoomStack.length > 0 ? zoomStack[zoomStack.length - 1] : data);

let cells = $state<HierarchyRectangularNode<TreemapNode>[]>([]);

// Assign top-level category colors
function getTopColor(node: HierarchyRectangularNode<TreemapNode>): string {
	let current = node;
	while (current.depth > 1 && current.parent) {
		current = current.parent;
	}
	const siblings = current.parent?.children ?? [current];
	const idx = siblings.indexOf(current);
	return palette[idx % palette.length] || '#3b82f6';
}

function getCellOpacity(node: HierarchyRectangularNode<TreemapNode>): number {
	// Deeper = more transparent for visual hierarchy
	return Math.max(0.5, 1 - (node.depth - 1) * 0.15);
}

function computeLayout() {
	if (!d3Mod) return;

	const root = d3Mod
		.hierarchy(currentRoot)
		.sum((d) => d.value ?? 0)
		.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

	d3Mod.treemap<TreemapNode>().size([width, height]).padding(2).round(true)(root);

	cells = (root.descendants() as HierarchyRectangularNode<TreemapNode>[]).filter((d) => d.depth > 0);
}

function cleanup() {
	resizeObserver?.disconnect();
	resizeObserver = undefined;
	d3Mod = undefined;
}

beforeNavigate(cleanup);
onDestroy(cleanup);

onMount(async () => {
	palette = getVizPalette();
	d3Mod = await import('d3-hierarchy');

	if (containerEl) {
		const rect = containerEl.getBoundingClientRect();
		width = rect.width || 600;
		height = rect.height || 400;
	}

	computeLayout();
	ready = true;

	if (containerEl) {
		resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				width = entry.contentRect.width || 600;
				height = entry.contentRect.height || 400;
			}
		});
		resizeObserver.observe(containerEl);
	}
});

// Recompute on data, zoom, or size change
$effect(() => {
	// Track reactive deps
	const _data = data;
	const _currentRoot = currentRoot;
	const _w = width;
	const _h = height;
	if (d3Mod && ready) {
		computeLayout();
	}
});

function zoomIn(node: HierarchyRectangularNode<TreemapNode>) {
	if (node.data.children && node.data.children.length > 0) {
		zoomStack = [...zoomStack, node.data];
	}
}

function zoomTo(index: number) {
	if (index < 0) {
		zoomStack = [];
	} else {
		zoomStack = zoomStack.slice(0, index + 1);
	}
}

function canShowLabel(node: HierarchyRectangularNode<TreemapNode>): boolean {
	const w = (node.x1 ?? 0) - (node.x0 ?? 0);
	const h = (node.y1 ?? 0) - (node.y0 ?? 0);
	return w > 40 && h > 24;
}

function canShowValue(node: HierarchyRectangularNode<TreemapNode>): boolean {
	const w = (node.x1 ?? 0) - (node.x0 ?? 0);
	const h = (node.y1 ?? 0) - (node.y0 ?? 0);
	return w > 50 && h > 38;
}
</script>

<figure class={cn(chartContainerVariants({ aspect }), className)}>
	<figcaption class="sr-only">{ariaLabel}</figcaption>

	<!-- Breadcrumb navigation -->
	{#if zoomStack.length > 0}
		<nav class="breadcrumb" aria-label="Treemap zoom navigation">
			<button class="breadcrumb-item" onclick={() => zoomTo(-1)}>
				{data.label || 'Root'}
			</button>
			{#each zoomStack as crumb, i}
				<span class="breadcrumb-sep" aria-hidden="true">/</span>
				{#if i === zoomStack.length - 1}
					<span class="breadcrumb-current">{crumb.label || crumb.id}</span>
				{:else}
					<button class="breadcrumb-item" onclick={() => zoomTo(i)}>
						{crumb.label || crumb.id}
					</button>
				{/if}
			{/each}
		</nav>
	{/if}

	{#if !ready}
		<div class="skeleton" role="status">
			<svg viewBox="0 0 400 300" class="skeleton-svg" aria-hidden="true">
				<rect x="2" y="2" width="230" height="170" rx="2" class="skeleton-cell pulse-1" />
				<rect x="236" y="2" width="162" height="100" rx="2" class="skeleton-cell pulse-2" />
				<rect x="236" y="106" width="162" height="66" rx="2" class="skeleton-cell pulse-3" />
				<rect x="2" y="176" width="130" height="122" rx="2" class="skeleton-cell pulse-4" />
				<rect x="136" y="176" width="130" height="122" rx="2" class="skeleton-cell pulse-1" />
				<rect x="270" y="176" width="128" height="122" rx="2" class="skeleton-cell pulse-2" />
			</svg>
			<span class="sr-only">Loading treemap</span>
		</div>
	{/if}

	<div
		class="treemap-container"
		class:visible={ready}
		bind:this={containerEl}
	>
		<svg
			{width}
			{height}
			viewBox="0 0 {width} {height}"
			role="img"
			aria-label={ariaLabel}
		>
			{#each cells as cell}
				{@const cellW = cell.x1 - cell.x0}
				{@const cellH = cell.y1 - cell.y0}
				{@const hasChildren = (cell.data.children?.length ?? 0) > 0}
				<g
					class="treemap-cell"
					class:clickable={hasChildren}
					transform="translate({cell.x0},{cell.y0})"
					onclick={() => hasChildren && zoomIn(cell)}
					onkeydown={(e) => {
						if ((e.key === 'Enter' || e.key === ' ') && hasChildren) {
							e.preventDefault();
							zoomIn(cell);
						}
					}}
					onmouseenter={() => (hoveredId = cell.data.id)}
					onmouseleave={() => (hoveredId = null)}
					role={hasChildren ? 'button' : 'img'}
					tabindex={hasChildren ? 0 : -1}
					aria-label="{cell.data.label || cell.data.id}: {formatValue(cell.value ?? 0)}"
				>
					<rect
						width={cellW}
						height={cellH}
						rx="2"
						fill={getTopColor(cell)}
						opacity={getCellOpacity(cell)}
						class="cell-rect"
						class:hovered={hoveredId === cell.data.id}
					/>
					{#if canShowLabel(cell)}
						<text
							x="4"
							y="14"
							class="cell-label"
						>
							{cell.data.label || cell.data.id}
						</text>
					{/if}
					{#if canShowValue(cell)}
						<text
							x="4"
							y="28"
							class="cell-value"
						>
							{formatValue(cell.value ?? 0)}
						</text>
					{/if}
				</g>
			{/each}
		</svg>

		<!-- Tooltip -->
		{#if hoveredId}
			{@const hovered = cells.find((c) => c.data.id === hoveredId)}
			{#if hovered}
				<div
					class="treemap-tooltip"
					style:left="{Math.min(hovered.x0 + 8, width - 120)}px"
					style:top="{Math.max(hovered.y0 - 32, 0)}px"
				>
					<strong>{hovered.data.label || hovered.data.id}</strong>
					<span>{formatValue(hovered.value ?? 0)}</span>
				</div>
			{/if}
		{/if}
	</div>
</figure>

<style>
	.breadcrumb {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		padding: var(--spacing-2) var(--spacing-1);
		font-size: 13px;
		position: absolute;
		top: 0;
		left: 0;
		z-index: 1;
	}

	.breadcrumb-item {
		color: var(--color-primary);
		font-weight: 500;
		cursor: pointer;
		background: none;
		border: none;
		padding: 0;
		font-size: inherit;
	}

	.breadcrumb-item:hover {
		text-decoration: underline;
	}

	.breadcrumb-sep {
		color: var(--color-muted);
	}

	.breadcrumb-current {
		color: var(--color-fg);
		font-weight: 600;
	}

	.skeleton {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.skeleton-svg {
		width: 100%;
		height: 100%;
		max-height: 300px;
	}

	.skeleton-cell {
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

	.treemap-container {
		width: 100%;
		height: 100%;
		position: absolute;
		inset: 0;
		opacity: 0;
		transition: opacity 0.15s ease-in;
	}

	.treemap-container.visible {
		opacity: 1;
	}

	.treemap-cell {
		outline: none;
	}

	.treemap-cell.clickable {
		cursor: pointer;
	}

	.treemap-cell:focus-visible .cell-rect {
		stroke: var(--color-primary);
		stroke-width: 2;
		stroke-dasharray: 4 2;
	}

	.cell-rect {
		transition: opacity 0.1s ease;
	}

	.cell-rect.hovered {
		opacity: 1 !important;
		filter: brightness(1.15);
	}

	.cell-label {
		font-size: 11px;
		font-weight: 600;
		fill: white;
		pointer-events: none;
		user-select: none;
	}

	.cell-value {
		font-size: 10px;
		font-weight: 400;
		fill: rgba(255, 255, 255, 0.8);
		pointer-events: none;
		user-select: none;
	}

	.treemap-tooltip {
		position: absolute;
		background: var(--chart-tooltip-bg);
		border: 1px solid var(--chart-grid);
		border-radius: 4px;
		padding: 4px 8px;
		font-size: 12px;
		color: var(--chart-label);
		pointer-events: none;
		display: flex;
		flex-direction: column;
		gap: 2px;
		z-index: 10;
	}
</style>
