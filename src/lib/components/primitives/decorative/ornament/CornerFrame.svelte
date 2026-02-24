<script lang="ts">
	import { cn } from '$lib/utils/cn';

	type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
	type FrameVariant = 'bracket' | 'double' | 'inset' | 'cross';

	interface Props {
		variant?: FrameVariant;
		size?: number;
		strokeWidth?: number;
		corners?: Corner[];
		offset?: number;
		color?: string;
		opacity?: number;
		class?: string;
	}

	let {
		variant = 'bracket',
		size = 24,
		strokeWidth = 1.5,
		corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as Corner[],
		offset = 0,
		color = 'currentColor',
		opacity = 0.6,
		class: className
	}: Props = $props();

	const positionClasses: Record<Corner, string> = {
		'top-left': 'top-0 left-0',
		'top-right': 'top-0 right-0',
		'bottom-left': 'bottom-0 left-0',
		'bottom-right': 'bottom-0 right-0'
	};

	const transforms: Record<Corner, string> = {
		'top-left': '',
		'top-right': 'scaleX(-1)',
		'bottom-left': 'scaleY(-1)',
		'bottom-right': 'scale(-1)'
	};
</script>

{#each corners as corner}
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke={color}
		stroke-width={strokeWidth}
		stroke-linecap="square"
		aria-hidden="true"
		class={cn('corner-frame absolute pointer-events-none', positionClasses[corner], className)}
		style:transform={transforms[corner] || undefined}
		style:margin={offset > 0 ? `${offset}px` : undefined}
		style:opacity={opacity}
	>
		{#if variant === 'bracket'}
			<polyline points="0,10 0,0 10,0" />
		{:else if variant === 'double'}
			<polyline points="0,12 0,0 12,0" />
			<polyline points="4,12 4,4 12,4" stroke-opacity="0.5" />
		{:else if variant === 'inset'}
			<polyline points="0,10 0,0 10,0" />
			<line x1="0" y1="5" x2="5" y2="0" stroke-opacity="0.4" stroke-width={strokeWidth * 0.75} />
		{:else if variant === 'cross'}
			<line x1="0" y1="0" x2="10" y2="0" />
			<line x1="0" y1="0" x2="0" y2="10" />
			<circle cx="0" cy="0" r="1.5" fill={color} stroke="none" />
		{/if}
	</svg>
{/each}

<style>
	.corner-frame {
		cursor: default;
	}

	@media (forced-colors: active) {
		.corner-frame {
			forced-color-adjust: auto;
		}
	}
</style>
