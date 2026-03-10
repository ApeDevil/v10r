<script lang="ts">
import { cn } from '$lib/utils/cn';

interface Props {
	position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
	size?: number;
	color?: string;
	strokeWidth?: number;
	class?: string;
}

let { position = 'top-left', size = 48, color = 'currentColor', strokeWidth = 1.5, class: className }: Props = $props();

const positionClasses: Record<string, string> = {
	'top-left': 'top-0 left-0',
	'top-right': 'top-0 right-0',
	'bottom-left': 'bottom-0 left-0',
	'bottom-right': 'bottom-0 right-0',
};

const transforms: Record<string, string> = {
	'top-left': '',
	'top-right': 'scaleX(-1)',
	'bottom-left': 'scaleY(-1)',
	'bottom-right': 'scale(-1)',
};
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 48 48"
	fill="none"
	stroke={color}
	stroke-width={strokeWidth}
	stroke-linecap="round"
	aria-hidden="true"
	class={cn('absolute pointer-events-none', positionClasses[position], className)}
	style:transform={transforms[position]}
>
	<!-- Inner curve -->
	<path d="M2.5 26 Q2.5 2.5 26 2.5" />
	<!-- Outer curve -->
	<path d="M2.5 42 Q2.5 2.5 42 2.5" opacity="0.4" />
	<!-- Corner dot -->
	<circle cx="2.5" cy="2.5" r="1.5" fill={color} stroke="none" />
</svg>

<style>
	@media (forced-colors: active) {
		svg {
			forced-color-adjust: auto;
		}
	}
</style>
