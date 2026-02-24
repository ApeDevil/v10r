<script lang="ts">
	import { cn } from '$lib/utils/cn';

	interface Props {
		folds?: 3 | 4 | 5 | 6 | 7 | 8;
		size?: number;
		color?: string;
		strokeWidth?: number;
		filled?: boolean;
		class?: string;
	}

	let {
		folds = 6,
		size = 64,
		color = 'currentColor',
		strokeWidth = 1,
		filled = false,
		class: className
	}: Props = $props();

	const offset = 16;
	const petalRadius = 16;

	let circles = $derived(
		Array.from({ length: folds }, (_, i) => {
			const angle = (2 * Math.PI * i) / folds - Math.PI / 2;
			return {
				cx: 50 + offset * Math.cos(angle),
				cy: 50 + offset * Math.sin(angle)
			};
		})
	);

	const clipId = `kamon-${Math.random().toString(36).slice(2, 9)}`;
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 100 100"
	aria-hidden="true"
	class={cn('inline-block shrink-0', className)}
>
	<defs>
		<clipPath id={clipId}>
			<circle cx="50" cy="50" r="34" />
		</clipPath>
	</defs>

	<!-- Clipped petal circles -->
	<g clip-path="url(#{clipId})">
		{#each circles as { cx, cy }}
			<circle
				{cx}
				{cy}
				r={petalRadius}
				fill={filled ? color : 'none'}
				stroke={color}
				stroke-width={strokeWidth}
			/>
		{/each}
	</g>

	<!-- Outer boundary -->
	<circle
		cx="50"
		cy="50"
		r="34"
		fill="none"
		stroke={color}
		stroke-width={strokeWidth}
	/>

	<!-- Center dot -->
	<circle
		cx="50"
		cy="50"
		r="2.5"
		fill={color}
	/>
</svg>

<style>
	@media (forced-colors: active) {
		svg {
			forced-color-adjust: auto;
		}
	}
</style>
