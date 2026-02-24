<script lang="ts">
	import { cn } from '$lib/utils/cn';

	interface Props {
		rings?: 2 | 3 | 4 | 5 | 6 | 7 | 8;
		shape?: 'circle' | 'square' | 'hexagon';
		spacing?: number;
		strokeWidth?: number;
		opacity?: number;
		color?: string;
		size?: number;
		class?: string;
	}

	let {
		rings = 4,
		shape = 'circle',
		spacing = 12,
		strokeWidth = 1,
		opacity = 0.2,
		color = 'currentColor',
		size = 120,
		class: className
	}: Props = $props();

	let cx = $derived(size / 2);
	let cy = $derived(size / 2);

	let radii = $derived(
		Array.from({ length: rings }, (_, i) => spacing * (i + 1))
	);

	function hexagonPoints(centerX: number, centerY: number, r: number): string {
		return Array.from({ length: 6 }, (_, i) => {
			const a = (i * Math.PI) / 3 - Math.PI / 6;
			return `${centerX + r * Math.cos(a)},${centerY + r * Math.sin(a)}`;
		}).join(' ');
	}
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 {size} {size}"
	fill="none"
	stroke={color}
	stroke-width={strokeWidth}
	aria-hidden="true"
	class={cn('inline-block shrink-0', className)}
>
	{#each radii as r, i}
		{@const ringOpacity = opacity * (1 - i / rings)}
		{#if shape === 'circle'}
			<circle {cx} {cy} {r} stroke-opacity={ringOpacity} />
		{:else if shape === 'square'}
			<rect
				x={cx - r}
				y={cy - r}
				width={r * 2}
				height={r * 2}
				stroke-opacity={ringOpacity}
			/>
		{:else if shape === 'hexagon'}
			<polygon
				points={hexagonPoints(cx, cy, r)}
				stroke-opacity={ringOpacity}
			/>
		{/if}
	{/each}
</svg>

<style>
	@media (forced-colors: active) {
		svg {
			forced-color-adjust: auto;
		}
	}
</style>
