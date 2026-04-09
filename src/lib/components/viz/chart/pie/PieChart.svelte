<script lang="ts">
import type { ChartData, Chart as ChartJS, ChartOptions } from 'chart.js';
import { onDestroy, onMount, untrack } from 'svelte';
import { beforeNavigate } from '$app/navigation';
import { cn } from '$lib/utils/cn';
import { type ChartContainerVariants, chartContainerVariants } from '../../_shared/chart-container';
import { buildChartTheme } from '../../_shared/chart-theme';
import { getChartInfraColors, onThemeChange, resolveDatasetColors } from '../../_shared/theme-bridge';

interface Props {
	data: ChartData<'pie'>;
	options?: ChartOptions<'pie'>;
	aspect?: ChartContainerVariants['aspect'];
	ariaLabel?: string;
	doughnut?: boolean;
	class?: string;
}

let {
	data,
	options = {},
	aspect = 'square',
	ariaLabel = 'Pie chart',
	doughnut = false,
	class: className,
}: Props = $props();

let canvasEl: HTMLCanvasElement | undefined = $state();
let chart: ChartJS<'pie' | 'doughnut'> | undefined = $state();
let ready = $state(false);
let unsub: (() => void) | undefined;

/** Set slice borderColor to chart bg so gaps blend with the surface */
function applySliceBorders<T extends { datasets: unknown[] }>(chartData: T): T {
	const bg = getChartInfraColors().bg;
	const datasets = chartData.datasets as Record<string, unknown>[];
	return {
		...chartData,
		datasets: datasets.map((ds) => ({ ...ds, borderColor: bg })),
	} as T;
}

function updateChart(d: ChartData<'pie'>, opts: ChartOptions<'pie'>, animate = true) {
	if (!chart) return;
	chart.data = applySliceBorders(resolveDatasetColors(d));
	const t = buildChartTheme();
	Object.assign(chart.options, {
		plugins: { ...t.defaults.plugins, ...opts.plugins },
		...opts,
	});
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
	const { registerPieChart } = await import('../../_shared/register');
	const Chart = await registerPieChart();
	const theme = buildChartTheme();

	if (!canvasEl) return;

	chart = new Chart(canvasEl, {
		type: (doughnut ? 'doughnut' : 'pie') as 'pie',
		data: applySliceBorders(resolveDatasetColors(data)),
		options: {
			responsive: true,
			maintainAspectRatio: true,
			plugins: {
				...theme.defaults.plugins,
				...options.plugins,
			},
			...options,
		},
	}) as ChartJS<'pie' | 'doughnut'>;

	unsub = onThemeChange(() => updateChart(data, options, false));

	requestAnimationFrame(() => chart?.resize());
	ready = true;
});

// Note: `doughnut` is construction-only — Chart.js type cannot change after creation
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
			<svg viewBox="0 0 300 300" class="skeleton-svg" aria-hidden="true">
				<circle cx="150" cy="150" r="120" class="skeleton-ring" />
				<line x1="150" y1="30" x2="150" y2="150" class="skeleton-divider" />
				<line x1="150" y1="150" x2="254" y2="210" class="skeleton-divider" />
				<line x1="150" y1="150" x2="46" y2="210" class="skeleton-divider" />
			</svg>
			<span class="sr-only">Loading pie chart</span>
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
		max-width: 300px;
		max-height: 300px;
	}

	.skeleton-ring {
		fill: none;
		stroke: var(--chart-grid);
		stroke-width: 3;
		animation: pulse 1.5s ease-in-out infinite;
	}

	.skeleton-divider {
		stroke: var(--chart-grid);
		stroke-width: 2;
		opacity: 0.5;
	}

	@keyframes pulse {
		0%, 100% { opacity: 0.3; }
		50% { opacity: 0.6; }
	}

	.chart-canvas {
		opacity: 0;
		transition: opacity 0.15s ease-in;
	}

	.chart-canvas.visible {
		opacity: 1;
	}
</style>
