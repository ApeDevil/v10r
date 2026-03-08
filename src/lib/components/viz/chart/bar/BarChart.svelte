<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { cn } from '$lib/utils/cn';
	import { chartContainerVariants, type ChartContainerVariants } from '../../_shared/chart-container';
	import { buildChartTheme } from '../../_shared/chart-theme';
	import { onThemeChange, resolveDatasetColors } from '../../_shared/theme-bridge';
	import type { Chart as ChartJS, ChartData, ChartOptions } from 'chart.js';

	interface Props {
		data: ChartData<'bar'>;
		options?: ChartOptions<'bar'>;
		aspect?: ChartContainerVariants['aspect'];
		ariaLabel?: string;
		horizontal?: boolean;
		class?: string;
	}

	let {
		data,
		options = {},
		aspect = 'chart',
		ariaLabel = 'Bar chart',
		horizontal = false,
		class: className,
	}: Props = $props();

	let canvasEl: HTMLCanvasElement | undefined = $state();
	let chart: ChartJS<'bar'> | undefined = $state();
	let ready = $state(false);
	let unsub: (() => void) | undefined;

	function updateChart(d: ChartData<'bar'>, opts: ChartOptions<'bar'>, h: boolean, animate = true) {
		if (!chart) return;
		chart.data = resolveDatasetColors(d);
		const t = buildChartTheme();
		Object.assign(chart.options, t.defaults, opts, { indexAxis: h ? 'y' : 'x' });
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
		const { registerBarChart } = await import('../../_shared/register');
		const Chart = await registerBarChart();
		const theme = buildChartTheme();

		if (!canvasEl) return;

		chart = new Chart(canvasEl, {
			type: 'bar',
			data: resolveDatasetColors(data),
			options: {
				responsive: true,
				maintainAspectRatio: true,
				indexAxis: horizontal ? 'y' : 'x',
				...theme.defaults,
				...options,
			},
		});

		unsub = onThemeChange(() => updateChart(data, options, horizontal, false));

		requestAnimationFrame(() => chart?.resize());
		ready = true;
	});

	// Update chart when data or options change
	$effect(() => {
		const _data = data;
		const _options = options;
		const _horizontal = horizontal;

		untrack(() => updateChart(_data, _options, _horizontal));
	});
</script>

<figure class={cn(chartContainerVariants({ aspect }), className)}>
	<figcaption class="sr-only">{ariaLabel}</figcaption>

	{#if !ready}
		<div class="skeleton" role="status">
			<svg viewBox="0 0 400 300" class="skeleton-svg" aria-hidden="true">
				<line x1="40" y1="20" x2="40" y2="280" class="skeleton-axis" />
				<line x1="40" y1="280" x2="380" y2="280" class="skeleton-axis" />
				<rect x="60" y="100" width="50" height="180" rx="4" class="skeleton-bar pulse-1" />
				<rect x="130" y="140" width="50" height="140" rx="4" class="skeleton-bar pulse-2" />
				<rect x="200" y="80" width="50" height="200" rx="4" class="skeleton-bar pulse-3" />
				<rect x="270" y="160" width="50" height="120" rx="4" class="skeleton-bar pulse-4" />
			</svg>
			<span class="sr-only">Loading bar chart</span>
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

	.skeleton-bar {
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

	.chart-canvas {
		opacity: 0;
		transition: opacity 0.15s ease-in;
	}

	.chart-canvas.visible {
		opacity: 1;
	}
</style>
