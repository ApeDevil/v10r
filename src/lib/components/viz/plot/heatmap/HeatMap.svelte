<script lang="ts">
import { onDestroy, onMount } from 'svelte';
import { beforeNavigate } from '$app/navigation';
import { cn } from '$lib/utils/cn';
import { type ChartContainerVariants, chartContainerVariants } from '../../_shared/chart-container';
import { getChartInfraColors, getCSSVar } from '../../_shared/theme-bridge';
import type { HeatMapData } from './types';

interface Props {
	data: HeatMapData;
	/** Custom color range [low, high] as hex strings. Defaults to chart grid → chart-1 */
	colorRange?: [string, string];
	aspect?: ChartContainerVariants['aspect'];
	ariaLabel?: string;
	/** Show numeric values inside cells when cells are large enough */
	showValues?: boolean;
	/** Format cell values for tooltip and in-cell display */
	formatValue?: (value: number) => string;
	class?: string;
}

let {
	data,
	colorRange,
	aspect = 'chart',
	ariaLabel = 'Heat map',
	showValues = false,
	formatValue = (v: number) => String(Math.round(v * 100) / 100),
	class: className,
}: Props = $props();

let figureEl: HTMLElement | undefined = $state();
let canvasEl: HTMLCanvasElement | undefined = $state();
let ctx: CanvasRenderingContext2D | undefined = $state();
let ready = $state(false);
let cw = $state(0);
let ch = $state(0);
let observer: ResizeObserver | undefined;

// Hover state
let hoverRow = $state(-1);
let hoverCol = $state(-1);

let isEmpty = $derived(data.xLabels.length === 0 || data.yLabels.length === 0 || data.values.length === 0);

const FONT = '12px system-ui, -apple-system, sans-serif';
const VALUE_FONT = '11px system-ui, -apple-system, sans-serif';
const PAD = { top: 10, right: 10, bottom: 50, left: 65 };
const GAP = 1;

function hexToRgb(hex: string): [number, number, number] {
	hex = hex.replace('#', '');
	if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
	return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

function lerp(t: number, a: [number, number, number], b: [number, number, number]): string {
	return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}

function getColorRange(): [[number, number, number], [number, number, number]] {
	if (colorRange) return [hexToRgb(colorRange[0]), hexToRgb(colorRange[1])];
	return [hexToRgb(getChartInfraColors().grid), hexToRgb(getCSSVar('chart-1'))];
}

function cells() {
	const cols = data.xLabels.length;
	const rows = data.yLabels.length;
	return {
		cols,
		rows,
		cellW: (cw - PAD.left - PAD.right) / (cols || 1),
		cellH: (ch - PAD.top - PAD.bottom) / (rows || 1),
	};
}

function draw() {
	if (!canvasEl || cw <= 0 || ch <= 0) return;
	if (!ctx) {
		ctx = canvasEl.getContext('2d') || undefined;
	}
	if (!ctx) return;

	const dpr = window.devicePixelRatio || 1;
	canvasEl.width = cw * dpr;
	canvasEl.height = ch * dpr;
	ctx.scale(dpr, dpr);
	ctx.clearRect(0, 0, cw, ch);

	const { cols, rows, cellW, cellH } = cells();
	if (rows === 0 || cols === 0) return;

	const flat = data.values.flat();
	const minV = Math.min(...flat);
	const maxV = Math.max(...flat);
	const range = maxV - minV || 1;

	const [lo, hi] = getColorRange();
	const labelColor = getCSSVar('chart-label') || '#6b7280';

	// Cells
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const val = data.values[r]?.[c] ?? 0;
			const t = (val - minV) / range;
			const x = PAD.left + c * cellW;
			const y = PAD.top + r * cellH;
			const w = cellW - GAP;
			const h = cellH - GAP;

			ctx.fillStyle = lerp(t, lo, hi);
			ctx.fillRect(x, y, w, h);

			// Highlight hovered cell
			if (r === hoverRow && c === hoverCol) {
				ctx.strokeStyle = labelColor;
				ctx.lineWidth = 2;
				ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
			}

			// Value text
			if (showValues && cellW > 32 && cellH > 22) {
				ctx.fillStyle = t > 0.55 ? '#ffffff' : '#000000';
				ctx.font = VALUE_FONT;
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText(formatValue(val), x + w / 2, y + h / 2);
			}
		}
	}

	// Y-axis labels
	ctx.fillStyle = labelColor;
	ctx.font = FONT;
	ctx.textAlign = 'right';
	ctx.textBaseline = 'middle';
	for (let r = 0; r < rows; r++) {
		ctx.fillText(data.yLabels[r], PAD.left - 8, PAD.top + r * cellH + (cellH - GAP) / 2);
	}

	// X-axis labels (rotated -45deg)
	ctx.fillStyle = labelColor;
	ctx.font = FONT;
	for (let c = 0; c < cols; c++) {
		ctx.save();
		ctx.translate(PAD.left + c * cellW + (cellW - GAP) / 2, PAD.top + rows * cellH + 8);
		ctx.rotate(-Math.PI / 4);
		ctx.textAlign = 'right';
		ctx.textBaseline = 'middle';
		ctx.fillText(data.xLabels[c], 0, 0);
		ctx.restore();
	}
}

function hitTest(e: MouseEvent): { row: number; col: number } | null {
	if (!canvasEl) return null;
	const rect = canvasEl.getBoundingClientRect();
	const mx = e.clientX - rect.left;
	const my = e.clientY - rect.top;
	const { cols, rows, cellW, cellH } = cells();
	const c = Math.floor((mx - PAD.left) / cellW);
	const r = Math.floor((my - PAD.top) / cellH);
	if (c >= 0 && c < cols && r >= 0 && r < rows) return { row: r, col: c };
	return null;
}

function handleMouseMove(e: MouseEvent) {
	const hit = hitTest(e);
	if (hit) {
		hoverRow = hit.row;
		hoverCol = hit.col;
	} else if (hoverRow !== -1) {
		hoverRow = -1;
		hoverCol = -1;
	}
}

function handleMouseLeave() {
	hoverRow = -1;
	hoverCol = -1;
}

// Tooltip positioning (derived from hover state)
let tooltipPos = $derived.by(() => {
	if (hoverRow < 0 || hoverCol < 0) return { x: 0, y: 0 };
	const { cellW, cellH } = cells();
	return {
		x: PAD.left + hoverCol * cellW + (cellW - GAP) / 2,
		y: PAD.top + hoverRow * cellH - 4,
	};
});

let tooltipText = $derived.by(() => {
	if (hoverRow < 0 || hoverCol < 0) return '';
	// Access data inside derived to track all dependencies
	return `${data.yLabels[hoverRow]} \u00b7 ${data.xLabels[hoverCol]}: ${formatValue(data.values[hoverRow]?.[hoverCol] ?? 0)}`;
});

function cleanup() {
	observer?.disconnect();
	observer = undefined;
	ctx = undefined;
}

beforeNavigate(cleanup);
onDestroy(cleanup);

onMount(() => {
	if (!figureEl) return;

	observer = new ResizeObserver((entries) => {
		const entry = entries[0];
		if (entry) {
			cw = entry.contentRect.width;
			ch = entry.contentRect.height;
		}
	});
	observer.observe(figureEl);

	ready = true;
});

// Reactive redraw
$effect(() => {
	// Track all dependencies that affect rendering
	const _data = data;
	const _cw = cw;
	const _ch = ch;
	const _cr = colorRange;
	const _sv = showValues;
	const _hr = hoverRow;
	const _hc = hoverCol;

	if (ready && _cw > 0 && _ch > 0) {
		draw();
	}
});

// Reset hover state when data dimensions change
$effect(() => {
	const _data = data;
	if (hoverRow >= _data.yLabels.length || hoverCol >= _data.xLabels.length) {
		hoverRow = -1;
		hoverCol = -1;
	}
});
</script>

<figure
	bind:this={figureEl}
	class={cn(chartContainerVariants({ aspect }), 'heatmap-figure', className)}
	aria-busy={!ready}
>
	<figcaption class="sr-only">{ariaLabel}</figcaption>

	{#if isEmpty}
		<div class="empty-state">No data</div>
	{:else}
		{#if !ready}
			<div class="skeleton" role="status">
				<svg viewBox="0 0 400 300" class="skeleton-svg" aria-hidden="true">
					<line x1="65" y1="10" x2="65" y2="260" class="skeleton-axis" />
					<line x1="65" y1="260" x2="395" y2="260" class="skeleton-axis" />
					{#each [0, 1, 2, 3] as r}
						{#each [0, 1, 2, 3, 4, 5] as c}
							<rect
								x={70 + c * 54}
								y={14 + r * 62}
								width="52"
								height="60"
								rx="2"
								class="skeleton-cell pulse-{((r + c) % 4) + 1}"
							/>
						{/each}
					{/each}
				</svg>
				<span class="sr-only">Loading heat map</span>
			</div>
		{/if}

		<canvas
			bind:this={canvasEl}
			role="img"
			aria-label={ariaLabel}
			class="heatmap-canvas"
			class:visible={ready}
			onmousemove={handleMouseMove}
			onmouseleave={handleMouseLeave}
		></canvas>

		{#if hoverRow >= 0 && hoverCol >= 0}
			<div
				class="heatmap-tooltip"
				role="tooltip"
				style="left: {tooltipPos.x}px; top: {tooltipPos.y}px;"
			>
				{tooltipText}
			</div>
		{/if}
	{/if}
</figure>

<style>
	.heatmap-figure {
		overflow: hidden;
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

	.skeleton-axis {
		stroke: var(--chart-grid);
		stroke-width: 2;
	}

	.skeleton-cell {
		fill: var(--chart-grid);
	}

	.pulse-1 { animation: pulse 1.5s ease-in-out infinite; }
	.pulse-2 { animation: pulse 1.5s ease-in-out 0.2s infinite; }
	.pulse-3 { animation: pulse 1.5s ease-in-out 0.4s infinite; }
	.pulse-4 { animation: pulse 1.5s ease-in-out 0.6s infinite; }

	@keyframes pulse {
		0%, 100% { opacity: 0.3; }
		50% { opacity: 0.6; }
	}

	.heatmap-canvas {
		width: 100%;
		height: 100%;
		opacity: 0;
		transition: opacity 0.15s ease-in;
	}

	.heatmap-canvas.visible {
		opacity: 1;
	}

	.heatmap-tooltip {
		position: absolute;
		transform: translate(-50%, -100%);
		padding: var(--spacing-2) var(--spacing-3);
		background: var(--chart-tooltip-bg);
		color: var(--color-fg);
		font-size: 12px;
		border-radius: var(--radius-sm);
		white-space: nowrap;
		pointer-events: none;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		z-index: var(--z-tooltip);
	}

	.empty-state {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
	}
</style>
