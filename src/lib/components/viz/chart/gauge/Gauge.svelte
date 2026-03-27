<script lang="ts">
import { cn } from '$lib/utils/cn';

interface ColorSegment {
	from: number;
	to: number;
	color: string;
}

interface Props {
	value: number;
	min?: number;
	max?: number;
	label?: string;
	segments?: ColorSegment[];
	size?: number;
	strokeWidth?: number;
	ariaLabel?: string;
	class?: string;
}

let {
	value,
	min = 0,
	max = 100,
	label,
	segments,
	size = 160,
	strokeWidth = 12,
	ariaLabel,
	class: className,
}: Props = $props();

const startAngle = 135;
const sweepAngle = 270;

const cx = $derived(size / 2);
const cy = $derived(size / 2);
const radius = $derived((size - strokeWidth) / 2);

const normalizedValue = $derived(Math.max(0, Math.min(1, (value - min) / (max - min || 1))));

function polarToCartesian(angle: number): { x: number; y: number } {
	const rad = ((angle - 90) * Math.PI) / 180;
	return {
		x: cx + radius * Math.cos(rad),
		y: cy + radius * Math.sin(rad),
	};
}

function arcPath(startDeg: number, endDeg: number): string {
	const start = polarToCartesian(startDeg);
	const end = polarToCartesian(endDeg);
	const sweep = endDeg - startDeg;
	const largeArc = sweep > 180 ? 1 : 0;
	return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

const bgArc = $derived(arcPath(startAngle, startAngle + sweepAngle));

const valueEndAngle = $derived(startAngle + normalizedValue * sweepAngle);
const valueArc = $derived(normalizedValue > 0.001 ? arcPath(startAngle, valueEndAngle) : '');

const segmentArcs = $derived(
	(segments ?? []).map((seg) => {
		const segStart = startAngle + ((seg.from - min) / (max - min || 1)) * sweepAngle;
		const segEnd = startAngle + ((seg.to - min) / (max - min || 1)) * sweepAngle;
		return { path: arcPath(segStart, segEnd), color: seg.color };
	}),
);

const valueColor = $derived.by(() => {
	if (!segments) return 'var(--chart-1)';
	for (const seg of segments) {
		if (value >= seg.from && value <= seg.to) return seg.color;
	}
	return 'var(--chart-1)';
});

const computedAriaLabel = $derived(ariaLabel ?? `Gauge: ${value} out of ${max}${label ? `, ${label}` : ''}`);
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 {size} {size}"
	role="img"
	aria-label={computedAriaLabel}
	class={cn('gauge', className)}
>
	<!-- Background arc -->
	<path
		d={bgArc}
		fill="none"
		stroke="var(--chart-grid)"
		stroke-width={strokeWidth}
		stroke-linecap="round"
	/>

	<!-- Segment arcs (background indicators) -->
	{#each segmentArcs as seg}
		<path
			d={seg.path}
			fill="none"
			stroke={seg.color}
			stroke-width={strokeWidth}
			stroke-linecap="butt"
			opacity="0.3"
		/>
	{/each}

	<!-- Value arc -->
	{#if valueArc}
		<path
			d={valueArc}
			fill="none"
			stroke={valueColor}
			stroke-width={strokeWidth}
			stroke-linecap="round"
		/>
	{/if}

	<!-- Center value text -->
	<text x={cx} y={label ? cy - 4 : cy} class="gauge-value">
		{value}
	</text>

	<!-- Label text -->
	{#if label}
		<text x={cx} y={cy + 16} class="gauge-label">
			{label}
		</text>
	{/if}
</svg>

<style>
	.gauge-value {
		text-anchor: middle;
		dominant-baseline: central;
		font-size: 28px;
		font-weight: 700;
		fill: var(--color-fg);
	}

	.gauge-label {
		text-anchor: middle;
		dominant-baseline: central;
		font-size: 12px;
		font-weight: 500;
		fill: var(--color-muted);
	}
</style>
