<script lang="ts">
import { cn } from '$lib/utils/cn';

interface Props {
	data: number[];
	type?: 'line' | 'bar' | 'area';
	width?: number;
	height?: number;
	color?: string;
	ariaLabel?: string;
	class?: string;
}

let {
	data,
	type = 'line',
	width = 80,
	height = 24,
	color = 'var(--chart-1)',
	ariaLabel = 'Sparkline',
	class: className,
}: Props = $props();

const padding = 2;

const min = $derived(Math.min(...data));
const max = $derived(Math.max(...data));
const range = $derived(max - min || 1);

const points = $derived(
	data.map((v, i) => ({
		x: padding + (i / (data.length - 1)) * (width - padding * 2),
		y: padding + (1 - (v - min) / range) * (height - padding * 2),
	})),
);

const linePath = $derived(points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' '));

const areaPath = $derived(
	`${linePath} L${points[points.length - 1]?.x ?? 0},${height - padding} L${padding},${height - padding} Z`,
);

const barWidth = $derived(Math.max(1, (width - padding * 2) / data.length - 1));
</script>

{#if data.length >= 2}
	<svg
		{width}
		{height}
		viewBox="0 0 {width} {height}"
		role="img"
		aria-label={ariaLabel}
		class={cn('inline-block align-middle', className)}
	>
		{#if type === 'bar'}
			{#each data as value, i}
				{@const barH = Math.max(1, ((value - min) / range) * (height - padding * 2))}
				<rect
					x={padding + i * ((width - padding * 2) / data.length)}
					y={height - padding - barH}
					width={barWidth}
					height={barH}
					fill={color}
					rx="1"
				/>
			{/each}
		{:else if type === 'area'}
			<path d={areaPath} fill={color} opacity="0.2" />
			<path d={linePath} fill="none" stroke={color} stroke-width="1.5" />
		{:else}
			<path d={linePath} fill="none" stroke={color} stroke-width="1.5" />
		{/if}
	</svg>
{:else if data.length === 1}
	<svg
		{width}
		{height}
		viewBox="0 0 {width} {height}"
		role="img"
		aria-label={ariaLabel}
		class={cn('inline-block align-middle', className)}
	>
		<circle cx={width / 2} cy={height / 2} r="2" fill={color} />
	</svg>
{/if}
