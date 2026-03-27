<script lang="ts">
import { cn } from '$lib/utils/cn';

interface Props {
	shape?: 'circle' | 'hexagon' | 'triangle' | 'square' | 'cross' | 'diamond';
	size?: number;
	color?: string;
	filled?: boolean;
	strokeWidth?: number;
	class?: string;
}

let {
	shape = 'circle',
	size = 24,
	color = 'currentColor',
	filled = false,
	strokeWidth = 1.5,
	class: className,
}: Props = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill={filled && shape !== 'cross' ? color : 'none'}
	stroke={color}
	stroke-width={strokeWidth}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	class={cn('inline-block shrink-0', className)}
>
	{#if shape === 'circle'}
		<circle cx="12" cy="12" r="10" />
	{:else if shape === 'hexagon'}
		<polygon points="12,2 20.7,7 20.7,17 12,22 3.3,17 3.3,7" />
	{:else if shape === 'triangle'}
		<polygon points="12,2.5 22,21.5 2,21.5" />
	{:else if shape === 'square'}
		<rect x="3" y="3" width="18" height="18" />
	{:else if shape === 'cross'}
		<line x1="12" y1="2.5" x2="12" y2="21.5" />
		<line x1="2.5" y1="12" x2="21.5" y2="12" />
	{:else if shape === 'diamond'}
		<polygon points="12,2 22,12 12,22 2,12" />
	{/if}
</svg>

<style>
	@media (forced-colors: active) {
		svg {
			forced-color-adjust: auto;
		}
	}
</style>
