<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';
	import { createDecorativeId } from '../utils';

	interface Props {
		frequency?: number;
		octaves?: number;
		opacity?: number;
		blend?: 'overlay' | 'soft-light' | 'multiply' | 'screen';
		class?: string;
		children?: Snippet;
	}

	let {
		frequency = 0.65,
		octaves = 4,
		opacity = 0.05,
		blend = 'overlay',
		class: className,
		children
	}: Props = $props();

	const filterId = createDecorativeId('noise');
</script>

<div class={cn('relative overflow-hidden', className)}>
	<div class="noise-layer" style:mix-blend-mode={blend} style:opacity={opacity} aria-hidden="true">
		<svg class="noise-svg">
			<defs>
				<filter id={filterId}>
					<feTurbulence
						type="fractalNoise"
						baseFrequency={frequency}
						numOctaves={octaves}
						stitchTiles="stitch"
					/>
					<feColorMatrix type="saturate" values="0" />
				</filter>
			</defs>
			<rect width="100%" height="100%" filter="url(#{filterId})" />
		</svg>
	</div>

	{#if children}
		<div class="relative z-1">
			{@render children()}
		</div>
	{/if}
</div>

<style>
	.noise-layer {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	.noise-svg {
		width: 100%;
		height: 100%;
	}

	@media (forced-colors: active) {
		.noise-layer {
			display: none;
		}
	}
</style>
