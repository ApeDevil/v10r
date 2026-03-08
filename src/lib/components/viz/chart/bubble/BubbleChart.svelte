<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { cn } from '$lib/utils/cn';
	import { chartContainerVariants, type ChartContainerVariants } from '../../_shared/chart-container';
	import { buildChartTheme } from '../../_shared/chart-theme';
	import { onThemeChange, resolveDatasetColors } from '../../_shared/theme-bridge';
	import type { Chart as ChartJS, ChartData, ChartOptions } from 'chart.js';

	interface Props {
		data: ChartData<'bubble'>;
		options?: ChartOptions<'bubble'>;
		aspect?: ChartContainerVariants['aspect'];
		ariaLabel?: string;
		class?: string;
	}

	let {
		data,
		options = {},
		aspect = 'chart',
		ariaLabel = 'Bubble chart',
		class: className,
	}: Props = $props();

	let canvasEl: HTMLCanvasElement | undefined = $state();
	let chart: ChartJS<'bubble'> | undefined = $state();
	let ready = $state(false);
	let unsub: (() => void) | undefined;

	function updateChart(d: ChartData<'bubble'>, opts: ChartOptions<'bubble'>, animate = true) {
		if (!chart) return;
		chart.data = resolveDatasetColors(d);
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
		const { registerBubbleChart } = await import('../../_shared/register');
		const Chart = await registerBubbleChart();
		const theme = buildChartTheme();

		if (!canvasEl) return;

		chart = new Chart(canvasEl, {
			type: 'bubble',
			data: resolveDatasetColors(data),
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
				<circle cx="100" cy="200" r="12" class="skeleton-bubble pulse-1" />
				<circle cx="160" cy="120" r="20" class="skeleton-bubble pulse-2" />
				<circle cx="240" cy="180" r="8" class="skeleton-bubble pulse-3" />
				<circle cx="200" cy="80" r="15" class="skeleton-bubble pulse-4" />
				<circle cx="300" cy="140" r="18" class="skeleton-bubble pulse-1" />
				<circle cx="340" cy="220" r="10" class="skeleton-bubble pulse-2" />
			</svg>
			<span class="sr-only">Loading bubble chart</span>
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

	.skeleton-bubble {
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
