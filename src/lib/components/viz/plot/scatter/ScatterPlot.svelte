<script lang="ts">
import type { ChartData, Chart as ChartJS, ChartOptions } from 'chart.js';
import { onDestroy, onMount, untrack } from 'svelte';
import { beforeNavigate } from '$app/navigation';
import { cn } from '$lib/utils/cn';
import { type ChartContainerVariants, chartContainerVariants } from '../../_shared/chart-container';
import { buildChartTheme } from '../../_shared/chart-theme';

interface Props {
	data: ChartData<'scatter'>;
	options?: ChartOptions<'scatter'>;
	aspect?: ChartContainerVariants['aspect'];
	ariaLabel?: string;
	class?: string;
}

let { data, options = {}, aspect = 'chart', ariaLabel = 'Scatter plot', class: className }: Props = $props();

let canvasEl: HTMLCanvasElement | undefined = $state();
let chart: ChartJS<'scatter'> | undefined = $state();
let ready = $state(false);

function cleanup() {
	chart?.destroy();
	chart = undefined;
}

beforeNavigate(cleanup);
onDestroy(cleanup);

onMount(async () => {
	const { registerScatterChart } = await import('../../_shared/register');
	const Chart = await registerScatterChart();
	const theme = buildChartTheme();

	if (!canvasEl) return;

	chart = new Chart(canvasEl, {
		type: 'scatter',
		data,
		options: {
			responsive: true,
			maintainAspectRatio: true,
			...theme.defaults,
			...options,
		},
	});

	requestAnimationFrame(() => chart?.resize());
	ready = true;
});

// svelte-ignore state_referenced_locally
$effect(() => {
	const _data = data;
	const _options = options;

	untrack(() => {
		if (!chart) return;
		chart.data = _data;
		const theme = buildChartTheme();
		Object.assign(chart.options, theme.defaults, _options);
		chart.update();
	});
});
</script>

<figure class={cn(chartContainerVariants({ aspect }), className)}>
	<figcaption class="sr-only">{ariaLabel}</figcaption>

	{#if !ready}
		<div class="skeleton" role="status">
			<svg viewBox="0 0 400 300" class="skeleton-svg" aria-hidden="true">
				<line x1="40" y1="20" x2="40" y2="280" class="skeleton-axis" />
				<line x1="40" y1="280" x2="380" y2="280" class="skeleton-axis" />
				<circle cx="80" cy="200" r="5" class="skeleton-dot pulse-1" />
				<circle cx="140" cy="120" r="5" class="skeleton-dot pulse-2" />
				<circle cx="180" cy="180" r="5" class="skeleton-dot pulse-3" />
				<circle cx="220" cy="90" r="5" class="skeleton-dot pulse-4" />
				<circle cx="260" cy="150" r="5" class="skeleton-dot pulse-1" />
				<circle cx="300" cy="110" r="5" class="skeleton-dot pulse-2" />
				<circle cx="340" cy="160" r="5" class="skeleton-dot pulse-3" />
				<circle cx="120" cy="240" r="5" class="skeleton-dot pulse-4" />
				<circle cx="200" cy="60" r="5" class="skeleton-dot pulse-1" />
			</svg>
			<span class="sr-only">Loading scatter plot</span>
		</div>
	{/if}

	<canvas
		bind:this={canvasEl}
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

	.skeleton-dot {
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

	.chart-canvas {
		opacity: 0;
		transition: opacity 0.15s ease-in;
	}

	.chart-canvas.visible {
		opacity: 1;
	}
</style>
