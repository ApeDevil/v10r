<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		cellSize?: number;
		strokeWidth?: number;
		color?: string;
		opacity?: number;
		highlights?: [number, number][];
		highlightColor?: string;
		class?: string;
		children?: Snippet;
	}

	let {
		cellSize = 30,
		strokeWidth = 1,
		color = 'currentColor',
		opacity = 0.1,
		highlights = [],
		highlightColor = 'currentColor',
		class: className,
		children
	}: Props = $props();

	const patternId = `grid-${Math.random().toString(36).slice(2, 9)}`;
</script>

<div class={cn('relative overflow-hidden', className)}>
	<svg class="pattern-layer" aria-hidden="true">
		<defs>
			<pattern
				id={patternId}
				width={cellSize}
				height={cellSize}
				patternUnits="userSpaceOnUse"
			>
				<path
					d="M {cellSize} 0 L 0 0 0 {cellSize}"
					fill="none"
					stroke={color}
					stroke-width={strokeWidth}
					stroke-opacity={opacity}
				/>
			</pattern>
		</defs>
		<rect width="100%" height="100%" fill="url(#{patternId})" />

		{#each highlights as [col, row]}
			<rect
				x={col * cellSize}
				y={row * cellSize}
				width={cellSize}
				height={cellSize}
				fill={highlightColor}
				fill-opacity="0.08"
			/>
		{/each}
	</svg>

	{#if children}
		<div class="relative z-1">
			{@render children()}
		</div>
	{/if}
</div>

<style>
	.pattern-layer {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	@media (forced-colors: active) {
		.pattern-layer {
			display: none;
		}
	}
</style>
