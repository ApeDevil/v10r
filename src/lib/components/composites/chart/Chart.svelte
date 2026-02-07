<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import {
		chartRootVariants,
		chartGridVariants,
		chartAxisVariants,
		chartTooltipVariants,
		type ChartRootVariants,
		type ChartGridVariants,
		type ChartAxisVariants
	} from './chart';

	interface ChartDataPoint {
		label: string;
		value: number;
		color?: string;
	}

	interface ChartSeries {
		name: string;
		data: ChartDataPoint[] | number[];
		color?: string;
	}

	interface Props {
		type?: 'bar' | 'line' | 'area';
		data: ChartSeries[] | ChartDataPoint[];
		labels?: string[];
		width?: number;
		height?: number;
		showGrid?: boolean;
		showLabels?: boolean;
		showTooltip?: boolean;
		animate?: boolean;
		class?: string;
		size?: ChartRootVariants['size'];
		gridStyle?: ChartGridVariants['style'];
		axisWeight?: ChartAxisVariants['weight'];
	}

	let {
		type = 'bar',
		data,
		labels = [],
		width = 600,
		height = 400,
		showGrid = true,
		showLabels = true,
		showTooltip = true,
		animate = true,
		class: className,
		size = 'md',
		gridStyle = 'solid',
		axisWeight = 'normal'
	}: Props = $props();

	// Tooltip state
	let tooltipVisible = $state(false);
	let tooltipContent = $state('');
	let tooltipX = $state(0);
	let tooltipY = $state(0);

	// Default colors from CSS custom properties
	const defaultColors = [
		'hsl(var(--color-primary))',
		'hsl(var(--color-secondary))',
		'hsl(var(--color-accent))',
		'hsl(var(--color-success))',
		'hsl(var(--color-warning))',
		'hsl(var(--color-error))'
	];

	// Chart dimensions with padding
	const padding = { top: 20, right: 20, bottom: 40, left: 50 };
	const chartWidth = $derived(width - padding.left - padding.right);
	const chartHeight = $derived(height - padding.top - padding.bottom);

	// Normalize data to ChartSeries[]
	const series = $derived.by(() => {
		if (Array.isArray(data) && data.length > 0) {
			// Check if it's ChartDataPoint[]
			if ('label' in data[0] && 'value' in data[0]) {
				return [
					{
						name: 'Series 1',
						data: data as ChartDataPoint[],
						color: defaultColors[0]
					}
				] as ChartSeries[];
			}
		}
		return data as ChartSeries[];
	});

	// Extract all labels
	const allLabels = $derived.by(() => {
		if (labels.length > 0) return labels;

		// Extract from first series
		const firstSeries = series[0];
		if (!firstSeries) return [];

		if (Array.isArray(firstSeries.data) && firstSeries.data.length > 0) {
			const first = firstSeries.data[0];
			if (typeof first === 'object' && 'label' in first) {
				return (firstSeries.data as ChartDataPoint[]).map((d) => d.label);
			}
		}

		// Generate numeric labels
		return Array.from({ length: firstSeries.data.length }, (_, i) => String(i + 1));
	});

	// Get max value for scaling
	const maxValue = $derived.by(() => {
		let max = 0;
		for (const s of series) {
			for (const point of s.data) {
				const value = typeof point === 'number' ? point : point.value;
				if (value > max) max = value;
			}
		}
		return max || 1;
	});

	// Scale functions
	const scaleY = (value: number) => {
		return chartHeight - (value / maxValue) * chartHeight;
	};

	const scaleX = (index: number) => {
		return (index / (allLabels.length - 1 || 1)) * chartWidth;
	};

	// Grid lines
	const gridLines = $derived.by(() => {
		const lines = [];
		const steps = 5;
		for (let i = 0; i <= steps; i++) {
			const y = (chartHeight / steps) * i;
			const value = maxValue * (1 - i / steps);
			lines.push({ y, value });
		}
		return lines;
	});

	// Handle tooltip
	function handleMouseMove(
		event: MouseEvent,
		seriesIndex: number,
		dataIndex: number,
		value: number
	) {
		if (!showTooltip) return;

		const target = event.currentTarget as SVGElement;
		const rect = target.getBoundingClientRect();

		tooltipVisible = true;
		tooltipContent = `${series[seriesIndex].name}: ${value}`;
		tooltipX = event.clientX - rect.left;
		tooltipY = event.clientY - rect.top - 10;
	}

	function handleMouseLeave() {
		tooltipVisible = false;
	}

	function handleFocus(
		event: FocusEvent,
		seriesIndex: number,
		dataIndex: number,
		value: number
	) {
		if (!showTooltip) return;
		const target = event.currentTarget as SVGElement;
		const rect = target.getBoundingClientRect();
		const svgEl = target.closest('svg');
		if (!svgEl) return;
		const svgRect = svgEl.getBoundingClientRect();

		tooltipVisible = true;
		tooltipContent = `${series[seriesIndex].name}: ${value}`;
		tooltipX = rect.left - svgRect.left + rect.width / 2;
		tooltipY = rect.top - svgRect.top - 10;
	}

	// Bar chart rendering
	function renderBar(seriesIndex: number, dataIndex: number, value: number) {
		const barWidth = chartWidth / allLabels.length / (series.length + 1);
		const x = scaleX(dataIndex) - (barWidth * series.length) / 2 + barWidth * seriesIndex;
		const y = scaleY(value);
		const h = chartHeight - y;
		const color = series[seriesIndex].color || defaultColors[seriesIndex % defaultColors.length];

		return {
			x,
			y,
			width: barWidth * 0.8,
			height: h,
			rx: 4,
			fill: color,
			style: animate ? `--chart-delay: ${dataIndex * 0.05}s` : ''
		};
	}

	// Line/Area chart rendering
	function renderPath(seriesIndex: number) {
		const s = series[seriesIndex];
		let points = '';

		s.data.forEach((point, i) => {
			const value = typeof point === 'number' ? point : point.value;
			const x = scaleX(i);
			const y = scaleY(value);
			points += `${i === 0 ? 'M' : 'L'} ${x},${y} `;
		});

		const color = s.color || defaultColors[seriesIndex % defaultColors.length];

		if (type === 'area') {
			// Close the path for area
			const lastX = scaleX(s.data.length - 1);
			points += `L ${lastX},${chartHeight} L 0,${chartHeight} Z`;

			return {
				d: points,
				fill: `url(#gradient-${seriesIndex})`,
				stroke: color,
				strokeWidth: 2
			};
		}

		// Line
		return {
			d: points,
			fill: 'none',
			stroke: color,
			strokeWidth: 2,
			strokeLinecap: 'round' as const,
			strokeLinejoin: 'round' as const
		};
	}

	// Get data points for line/area charts (for hover circles)
	function getDataPoints(seriesIndex: number) {
		const s = series[seriesIndex];
		return s.data.map((point, i) => {
			const value = typeof point === 'number' ? point : point.value;
			return {
				x: scaleX(i),
				y: scaleY(value),
				value,
				index: i
			};
		});
	}
</script>

<div class={cn(chartRootVariants({ size }), className)}>
	<svg
		{width}
		{height}
		viewBox="0 0 {width} {height}"
		preserveAspectRatio="xMidYMid meet"
		class="overflow-visible"
		role="img"
		aria-label="Chart visualization"
		onmouseleave={handleMouseLeave}
	>
		<title>Chart showing {series.length} data series</title>
		<desc>
			{type === 'bar' ? 'Bar chart' : type === 'line' ? 'Line chart' : 'Area chart'} with {allLabels.length}
			data points
		</desc>

		<g transform="translate({padding.left}, {padding.top})">
			<!-- Grid lines -->
			{#if showGrid}
				<g class={chartGridVariants({ style: gridStyle })}>
					{#each gridLines as line}
						<line x1="0" y1={line.y} x2={chartWidth} y2={line.y} />
					{/each}
				</g>
			{/if}

			<!-- Axes -->
			<line
				x1="0"
				y1={chartHeight}
				x2={chartWidth}
				y2={chartHeight}
				class="stroke-border"
				stroke-width="2"
			/>
			<line x1="0" y1="0" x2="0" y2={chartHeight} class="stroke-border" stroke-width="2" />

			<!-- Y-axis labels -->
			{#if showLabels}
				<g class={chartAxisVariants({ weight: axisWeight })}>
					{#each gridLines as line}
						<text x="-10" y={line.y} text-anchor="end" dominant-baseline="middle">
							{Math.round(line.value)}
						</text>
					{/each}
				</g>
			{/if}

			<!-- Area gradients -->
			{#if type === 'area'}
				<defs>
					{#each series as s, i}
						<linearGradient id="gradient-{i}" x1="0%" y1="0%" x2="0%" y2="100%">
							<stop
								offset="0%"
								stop-color={s.color || defaultColors[i % defaultColors.length]}
								stop-opacity="0.3"
							/>
							<stop
								offset="100%"
								stop-color={s.color || defaultColors[i % defaultColors.length]}
								stop-opacity="0.05"
							/>
						</linearGradient>
					{/each}
				</defs>
			{/if}

			<!-- Data rendering -->
			{#if type === 'bar'}
				<!-- Bar chart -->
				{#each series as s, seriesIndex}
					{#each s.data as point, dataIndex}
						{@const value = typeof point === 'number' ? point : point.value}
						{@const barProps = renderBar(seriesIndex, dataIndex, value)}
						<rect
							{...barProps}
							tabindex="0"
							role="graphics-symbol"
							aria-label="{series[seriesIndex].name}: {allLabels[dataIndex]} = {value}"
							onmousemove={(e) => handleMouseMove(e, seriesIndex, dataIndex, value)}
							onfocus={(e) => handleFocus(e, seriesIndex, dataIndex, value)}
							onblur={handleMouseLeave}
							class={cn('transition-opacity hover:opacity-80 focus-visible:opacity-80 cursor-pointer focus-visible:outline-none', animate && 'chart-animate-bar')}
						/>
					{/each}
				{/each}
			{:else}
				<!-- Line/Area chart -->
				{#each series as s, seriesIndex}
					{@const pathProps = renderPath(seriesIndex)}
					<path {...pathProps} class={animate ? 'chart-animate-line' : undefined} />

					<!-- Data point circles -->
					{#each getDataPoints(seriesIndex) as point}
						<circle
							cx={point.x}
							cy={point.y}
							r="4"
							fill={s.color || defaultColors[seriesIndex % defaultColors.length]}
							tabindex="0"
							role="graphics-symbol"
							aria-label="{s.name}: {allLabels[point.index]} = {point.value}"
							class="transition-all hover:r-6 cursor-pointer focus-visible:outline-none"
							onmousemove={(e) => handleMouseMove(e, seriesIndex, point.index, point.value)}
							onfocus={(e) => handleFocus(e, seriesIndex, point.index, point.value)}
							onblur={handleMouseLeave}
						/>
					{/each}
				{/each}
			{/if}

			<!-- X-axis labels -->
			{#if showLabels}
				<g class={chartAxisVariants({ weight: axisWeight })}>
					{#each allLabels as label, i}
						<text x={scaleX(i)} y={chartHeight + 25} text-anchor="middle">
							{label}
						</text>
					{/each}
				</g>
			{/if}
		</g>
	</svg>

	<!-- Accessible data table (visually hidden, available to screen readers) -->
	<table class="sr-only">
		<caption>{type === 'bar' ? 'Bar chart' : type === 'line' ? 'Line chart' : 'Area chart'} data</caption>
		<thead>
			<tr>
				<th scope="col">Category</th>
				{#each series as s}
					<th scope="col">{s.name}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each allLabels as label, i}
				<tr>
					<th scope="row">{label}</th>
					{#each series as s}
						{@const point = s.data[i]}
						<td>{typeof point === 'number' ? point : point.value}</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>

	<!-- Tooltip -->
	{#if showTooltip && tooltipVisible}
		<div
			class={chartTooltipVariants()}
			style="left: {tooltipX}px; top: {tooltipY}px; opacity: {tooltipVisible ? 1 : 0};"
		>
			{tooltipContent}
		</div>
	{/if}
</div>

<style>
	@keyframes grow-bar {
		from {
			transform: scaleY(0);
			transform-origin: bottom;
		}
		to {
			transform: scaleY(1);
			transform-origin: bottom;
		}
	}

	@keyframes draw-line {
		from {
			stroke-dasharray: 1000;
			stroke-dashoffset: 1000;
		}
		to {
			stroke-dasharray: 1000;
			stroke-dashoffset: 0;
		}
	}

	:global(.chart-animate-bar) {
		animation: grow-bar 0.6s ease-out var(--chart-delay, 0s) backwards;
	}

	:global(.chart-animate-line) {
		animation: draw-line 1s ease-out forwards;
	}
</style>
