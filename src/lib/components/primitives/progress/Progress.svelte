<script lang="ts">
	import { Progress as ProgressPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils/cn';
	import {
		progressTrackVariants,
		progressIndicatorVariants,
		type ProgressTrackVariants,
		type ProgressIndicatorVariants
	} from './progress';

	interface Props extends ProgressTrackVariants, ProgressIndicatorVariants {
		value?: number;
		max?: number;
		showLabel?: boolean;
		class?: string;
	}

	let {
		value = $bindable(),
		max = 100,
		variant = 'default',
		size = 'md',
		showLabel = false,
		class: className
	}: Props = $props();

	// Clamp value between 0 and max
	const clampedValue = $derived(
		value !== undefined ? Math.min(Math.max(value, 0), max) : undefined
	);

	// Calculate percentage
	const percentage = $derived(
		clampedValue !== undefined ? Math.round((clampedValue / max) * 100) : undefined
	);

	// Determine if indeterminate
	const isIndeterminate = $derived(value === undefined);
</script>

<div
	class={cn(
		'flex items-center gap-3',
		size === 'lg' && showLabel ? 'flex-col items-start' : 'flex-row',
		className
	)}
>
	<ProgressPrimitive.Root
		{value}
		{max}
		class={cn(progressTrackVariants({ size }), 'flex-1')}
	>
		{#if isIndeterminate}
			<div
				class={cn(
					progressIndicatorVariants({ variant }),
					'w-1/3 animate-indeterminate'
				)}
			/>
		{:else}
			<div
				class={progressIndicatorVariants({ variant })}
				style="width: {percentage}%"
			/>
		{/if}
	</ProgressPrimitive.Root>

	{#if showLabel && !isIndeterminate}
		<span
			class={cn(
				'text-muted tabular-nums',
				size === 'sm' && 'text-fluid-xs',
				size === 'md' && 'text-fluid-sm',
				size === 'lg' && 'text-fluid-base'
			)}
		>
			{percentage}%
		</span>
	{/if}
</div>

<style>
	@keyframes indeterminate {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(400%);
		}
	}

	.animate-indeterminate {
		animation: indeterminate 1.5s ease-in-out infinite;
	}

	@media (prefers-reduced-motion: reduce) {
		.animate-indeterminate {
			animation-duration: 3s;
		}
	}
</style>
