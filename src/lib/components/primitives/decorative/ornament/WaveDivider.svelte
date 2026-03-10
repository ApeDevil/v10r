<script lang="ts">
import { cn } from '$lib/utils/cn';

interface Props {
	shape?: 'wave' | 'curve' | 'zigzag' | 'slant';
	height?: number;
	color?: string;
	flip?: boolean;
	class?: string;
}

let { shape = 'wave', height = 48, color = 'currentColor', flip = false, class: className }: Props = $props();

const paths: Record<string, string> = {
	wave: 'M0,40 C200,80 400,0 600,40 C800,80 1000,0 1200,40 L1200,120 L0,120 Z',
	curve: 'M0,80 Q600,0 1200,80 L1200,120 L0,120 Z',
	zigzag:
		'M0,60 L100,30 L200,60 L300,30 L400,60 L500,30 L600,60 L700,30 L800,60 L900,30 L1000,60 L1100,30 L1200,60 L1200,120 L0,120 Z',
	slant: 'M0,120 L1200,0 L1200,120 Z',
};
</script>

<svg
	viewBox="0 0 1200 120"
	preserveAspectRatio="none"
	{height}
	fill={color}
	aria-hidden="true"
	class={cn('wave-divider', className)}
	style:transform={flip ? 'scaleY(-1)' : undefined}
>
	<path d={paths[shape]} />
</svg>

<style>
	.wave-divider {
		display: block;
		width: 100%;
	}

	@media (forced-colors: active) {
		.wave-divider {
			forced-color-adjust: auto;
		}
	}
</style>
