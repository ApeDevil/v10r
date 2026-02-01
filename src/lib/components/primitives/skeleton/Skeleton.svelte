<script lang="ts">
	import { cn } from '$lib/utils/cn';

	interface Props {
		variant?: 'text' | 'circular' | 'rectangular';
		width?: string;
		height?: string;
		class?: string;
	}

	let { variant = 'rectangular', width, height, class: className }: Props = $props();

	const variantClasses = {
		text: 'h-4 w-full rounded',
		circular: 'rounded-full',
		rectangular: 'rounded-md'
	};
</script>

<div
	class={cn(
		'animate-pulse bg-muted/30',
		variantClasses[variant],
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
</style>
