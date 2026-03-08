<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { cn } from '$lib/utils/cn';
	import { chartContainerVariants, type ChartContainerVariants } from '../../_shared/chart-container';
	import { buildChartTheme } from '../../_shared/chart-theme';
	import { getChartInfraColors, onThemeChange, resolveDatasetColors } from '../../_shared/theme-bridge';
	import type { Chart as ChartJS, ChartData, ChartOptions } from 'chart.js';

	interface Props {
		data: ChartData<'radar'>;
		options?: ChartOptions<'radar'>;
		aspect?: ChartContainerVariants['aspect'];
		ariaLabel?: string;
		class?: string;
	}

	let {
		data,
		options = {},
		aspect = 'square',
		ariaLabel = 'Radar chart',
		class: className,
	}: Props = $props();

	let canvasEl: HTMLCanvasElement | undefined = $state();
	let chart: ChartJS<'radar'> | undefined = $state();
	let ready = $state(false);
	let unsub: (() => void) | undefined;

	function buildRadarDefaults() {
		const theme = buildChartTheme();
		const infra = getChartInfraColors();
		return {
			...theme.defaults,
			scales: {
				r: {
					grid: { color: infra.grid },
					ticks: { color: infra.axis, backdropColor: 'transparent' },
					pointLabels: { color: infra.label },
					angleLines: { color: infra.grid },
				},
			},
		};
	}

	function updateChart(d: ChartData<'radar'>, opts: ChartOptions<'radar'>, animate = true) {
		if (!chart) return;
		chart.data = resolveDatasetColors(d);
		const defaults = buildRadarDefaults();
		Object.assign(chart.options, defaults, opts);
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
		const { registerRadarChart } = await import('../../_shared/register');
		const Chart = await registerRadarChart();
		const defaults = buildRadarDefaults();

		if (!canvasEl) return;

		chart = new Chart(canvasEl, {
			type: 'radar',
			data: resolveDatasetColors(data),
			options: {
				responsive: true,
				maintainAspectRatio: true,
				...defaults,
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
			<svg viewBox="0 0 300 300" class="skeleton-svg" aria-hidden="true">
				<!-- Pentagon outline -->
				<polygon
					points="150,30 270,118 225,262 75,262 30,118"
					class="skeleton-shape"
				/>
				<!-- Radial axes from center to each vertex -->
				<line x1="150" y1="150" x2="150" y2="30" class="skeleton-axis" />
				<line x1="150" y1="150" x2="270" y2="118" class="skeleton-axis" />
				<line x1="150" y1="150" x2="225" y2="262" class="skeleton-axis" />
				<line x1="150" y1="150" x2="75" y2="262" class="skeleton-axis" />
				<line x1="150" y1="150" x2="30" y2="118" class="skeleton-axis" />
			</svg>
			<span class="sr-only">Loading radar chart</span>
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

	.skeleton-shape {
		fill: none;
		stroke: var(--chart-grid);
		stroke-width: 2;
		animation: pulse 1.5s ease-in-out infinite;
	}

	.skeleton-axis {
		stroke: var(--chart-grid);
		stroke-width: 1;
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
