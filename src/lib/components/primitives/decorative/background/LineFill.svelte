<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';
	import { createDecorativeId } from '../utils';

	interface Props {
		variant?: 'scanline' | 'hatch' | 'crosshatch';
		spacing?: number;
		strokeWidth?: number;
		angle?: number;
		opacity?: number;
		color?: string;
		blend?: 'overlay' | 'soft-light' | 'multiply' | 'screen' | 'normal';
		class?: string;
		children?: Snippet;
	}

	let {
		variant = 'scanline',
		spacing: spacingProp = 12,
		strokeWidth = 1,
		angle: angleProp = 0,
		opacity: opacityProp = 0.1,
		color = 'currentColor',
		blend = 'normal',
		class: className,
		children
	}: Props = $props();

	const patternId = createDecorativeId('line');

	// Enforce minimum spacing: 12 for scanline/hatch, 16 for crosshatch
	let spacing = $derived(
		variant === 'crosshatch'
			? Math.max(spacingProp, 16)
			: Math.max(spacingProp, 12)
	);

	// Enforce opacity cap: 0.5 for scanline/hatch, 0.35 for crosshatch
	let opacity = $derived(
		variant === 'crosshatch'
			? Math.min(opacityProp, 0.35)
			: Math.min(opacityProp, 0.5)
	);

	// Default angle: 0 for scanline, 45 for hatch/crosshatch
	let angle = $derived(
		angleProp !== 0
			? angleProp
			: variant === 'scanline' ? 0 : 45
	);

	let patternTransform = $derived(angle !== 0 ? `rotate(${angle})` : undefined);
</script>

<div class={cn('relative overflow-hidden', className)}>
	<svg class="pattern-layer" aria-hidden="true" style:mix-blend-mode={blend} style:opacity={opacity}>
		<defs>
			<pattern
				id={patternId}
				width={spacing}
				height={spacing}
				patternUnits="userSpaceOnUse"
				patternTransform={patternTransform}
			>
				<line
					x1="0" y1="0"
					x2="0" y2={spacing}
					stroke={color}
					stroke-width={strokeWidth}
				/>
				{#if variant === 'crosshatch'}
					<line
						x1="0" y1="0"
						x2={spacing} y2="0"
						stroke={color}
						stroke-width={strokeWidth}
					/>
				{/if}
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
