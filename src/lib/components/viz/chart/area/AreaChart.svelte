<script lang="ts">
import type { ChartData, Chart as ChartJS, ChartOptions } from 'chart.js';
import { onDestroy, onMount, untrack } from 'svelte';
import { beforeNavigate } from '$app/navigation';
import { cn } from '$lib/utils/cn';
import { type ChartContainerVariants, chartContainerVariants } from '../../_shared/chart-container';
import { buildChartTheme } from '../../_shared/chart-theme';
import { onThemeChange, resolveDatasetColors } from '../../_shared/theme-bridge';

interface Props {
	data: ChartData<'line'>;
	options?: ChartOptions<'line'>;
	aspect?: ChartContainerVariants['aspect'];
	ariaLabel?: string;
	class?: string;
}

let { data, options = {}, aspect = 'chart', ariaLabel = 'Area chart', class: className }: Props = $props();

let canvasEl: HTMLCanvasElement | undefined = $state();
let chart: ChartJS<'line'> | undefined = $state();
let ready = $state(false);
let unsub: (() => void) | undefined;

/** Ensure each dataset has fill enabled */
function applyFill(chartData: ChartData<'line'>): ChartData<'line'> {
	return {
		...chartData,
		datasets: chartData.datasets.map((ds) => ({
			fill: true,
			...ds,
		})),
	};
}

function updateChart(d: ChartData<'line'>, opts: ChartOptions<'line'>, animate = true) {
	if (!chart) return;
	chart.data = resolveDatasetColors(applyFill(d));
	const t = buildChartTheme();
	Object.assign(chart.options, t.defaults, opts);
	chart.update(animate ? undefined : 'none');
}

function cleanup() {
	unsub?.();
	unsub = undefined;
	chart?.destroy();
	chart = undefined;
}

beforeNavigate(cleanup);
onDestroy(cleanup);

onMount(async () => {
	const { registerLineChart } = await import('../../_shared/register');
	const Chart = await registerLineChart();
	const theme = buildChartTheme();

	if (!canvasEl) return;

	chart = new Chart(canvasEl, {
		type: 'line',
		data: resolveDatasetColors(applyFill(data)),
		options: {
			responsive: true,
			maintainAspectRatio: true,
			...theme.defaults,
			...options,
		},
	});

	unsub = onThemeChange(() => updateChart(data, options, false));

	requestAnimationFrame(() => chart?.resize());
	ready = true;
});

$effect(() => {
	const _data = data;
	const _options = options;

	untrack(() => updateChart(_data, _options));
});
</script>

<figure class={cn(chartContainerVariants({ aspect }), className)}>
	<figcaption class="sr-only">{ariaLabel}</figcaption>

	{#if !ready}
		<div class="skeleton" role="status">
			<svg viewBox="0 0 400 300" class="skeleton-svg" aria-hidden="true">
				<line x1="40" y1="20" x2="40" y2="280" class="skeleton-axis" />
				<line x1="40" y1="280" x2="380" y2="280" class="skeleton-axis" />
				<path
					d="M 60,200 Q 120,100 180,180 T 300,120 T 360,160 L 360,280 L 60,280 Z"
					class="skeleton-area"
				/>
			</svg>
			<span class="sr-only">Loading area chart</span>
		</div>
	{/if}

	<canvas
		bind:this={canvasEl}
		role="img"
		aria-label={ariaLabel}
		class="chart-canvas"
		class:visible={ready}
	></canvas>
</figure>

<style>
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

	.skeleton-area {
		fill: var(--chart-grid);
		opacity: 0.15;
		stroke: var(--chart-grid);
		stroke-width: 2;
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 0.15; }
		50% { opacity: 0.35; }
	}

	.chart-canvas {
		opacity: 0;
		transition: opacity 0.15s ease-in;
	}

	.chart-canvas.visible {
		opacity: 1;
	}
</style>
