<script lang="ts">
import { cn } from '$lib/utils/cn';

interface Props {
	variant?: 'text' | 'circular' | 'rectangular';
	width?: string;
	height?: string;
	rounded?: string;
	class?: string;
}

let { variant = 'rectangular', width, height, rounded, class: className }: Props = $props();

const variantClasses = {
	text: 'h-4 w-full rounded',
	circular: 'rounded-full',
	rectangular: 'rounded-md',
};
</script>

<div
	class={cn(
		'animate-pulse skeleton-bg',
		variantClasses[variant],
		rounded && `rounded-${rounded}`,
		className
	)}
	style:width
	style:height
	aria-busy="true"
	aria-live="polite"
></div>

<style>
	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.animate-pulse {
		animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}

	/* UnoCSS can't apply opacity modifiers to CSS custom property colors */
	.skeleton-bg {
		background-color: color-mix(in srgb, var(--color-muted) 30%, transparent);
	}
</style>
