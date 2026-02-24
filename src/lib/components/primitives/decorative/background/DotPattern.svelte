<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';
	import { createDecorativeId } from '../utils';

	interface Props {
		spacing?: number;
		radius?: number;
		color?: string;
		opacity?: number;
		class?: string;
		children?: Snippet;
	}

	let {
		spacing = 20,
		radius = 1,
		color = 'currentColor',
		opacity = 0.15,
		class: className,
		children
	}: Props = $props();

	const patternId = createDecorativeId('dot');
</script>

<div class={cn('relative overflow-hidden', className)}>
	<svg class="pattern-layer" aria-hidden="true">
		<defs>
			<pattern
				id={patternId}
				width={spacing}
				height={spacing}
				patternUnits="userSpaceOnUse"
			>
				<circle
					cx={spacing / 2}
					cy={spacing / 2}
					r={radius}
					fill={color}
					fill-opacity={opacity}
				/>
			</pattern>
		</defs>
		<rect width="100%" height="100%" fill="url(#{patternId})" />
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
