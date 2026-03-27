<script lang="ts">
import { cn } from '$lib/utils/cn';

interface Props {
	orientation?: 'horizontal' | 'vertical';
	count?: number;
	majorEvery?: number;
	majorHeight?: number;
	minorHeight?: number;
	gap?: number;
	strokeWidth?: number;
	color?: string;
	opacity?: number;
	class?: string;
}

let {
	orientation = 'horizontal',
	count = 21,
	majorEvery = 5,
	majorHeight = 12,
	minorHeight = 6,
	gap = 10,
	strokeWidth = 1,
	color = 'currentColor',
	opacity = 0.4,
	class: className,
}: Props = $props();

let totalSpan = $derived((count - 1) * gap);
let isHorizontal = $derived(orientation === 'horizontal');

let ticks = $derived(
	Array.from({ length: count }, (_, i) => ({
		pos: i * gap,
		isMajor: i % majorEvery === 0,
		height: i % majorEvery === 0 ? majorHeight : minorHeight,
	})),
);
</script>

<svg
	width={isHorizontal ? totalSpan : majorHeight}
	height={isHorizontal ? majorHeight : totalSpan}
	viewBox="0 0 {isHorizontal ? totalSpan : majorHeight} {isHorizontal ? majorHeight : totalSpan}"
	aria-hidden="true"
	class={cn('tick-marks inline-block shrink-0', className)}
	style:opacity={opacity}
>
	{#each ticks as tick}
		{#if isHorizontal}
			<line
				x1={tick.pos}
				y1={0}
				x2={tick.pos}
				y2={tick.height}
				stroke={color}
				stroke-width={tick.isMajor ? strokeWidth * 1.5 : strokeWidth}
			/>
		{:else}
			<line
				x1={0}
				y1={tick.pos}
				x2={tick.height}
				y2={tick.pos}
				stroke={color}
				stroke-width={tick.isMajor ? strokeWidth * 1.5 : strokeWidth}
			/>
		{/if}
	{/each}
</svg>

<style>
	.tick-marks {
		display: block;
	}

	@media (forced-colors: active) {
		.tick-marks {
			forced-color-adjust: auto;
		}
	}
</style>
