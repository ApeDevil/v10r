<script lang="ts">
import { Progress as ProgressPrimitive } from 'bits-ui';
import { cn } from '$lib/utils/cn';

interface Props {
	value?: number;
	max?: number;
	variant?: 'default' | 'success' | 'warning' | 'error';
	size?: 'sm' | 'md' | 'lg';
	showLabel?: boolean;
	class?: string;
}

let {
	value = $bindable(),
	max = 100,
	variant = 'default',
	size = 'md',
	showLabel = false,
	class: className,
}: Props = $props();

// Clamp value between 0 and max
const clampedValue = $derived(value !== undefined ? Math.min(Math.max(value, 0), max) : undefined);

// Calculate percentage
const percentage = $derived(clampedValue !== undefined ? Math.round((clampedValue / max) * 100) : undefined);

// Determine if indeterminate
const isIndeterminate = $derived(value === undefined);
</script>

<div
	class={cn(
		'progress-wrapper',
		size === 'lg' && showLabel && 'progress-wrapper--col',
		className
	)}
>
	<ProgressPrimitive.Root
		value={isIndeterminate ? null : value}
		{max}
		class={`progress-${size}`}
	>
		<div
			class={cn(
				'progress-indicator',
				`progress-${variant}`,
				isIndeterminate && 'progress-indeterminate'
			)}
			style={!isIndeterminate ? `width: ${percentage}%` : undefined}
		></div>
	</ProgressPrimitive.Root>

	{#if showLabel && !isIndeterminate}
		<span class={`progress-label progress-label--${size}`}>
			{percentage}%
		</span>
	{/if}
</div>

<style>
	/* Wrapper */
	.progress-wrapper {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		flex-direction: row;
	}

	.progress-wrapper--col {
		flex-direction: column;
		align-items: flex-start;
	}

	/* Root / Track */
	:global([data-progress-root]) {
		position: relative;
		width: 100%;
		overflow: hidden;
		border-radius: var(--radius-full);
		background: color-mix(in srgb, var(--color-muted) 20%, transparent);
		flex: 1;
	}

	/* Size variants */
	:global(.progress-sm[data-progress-root]) {
		height: 0.375rem;
	}

	:global(.progress-md[data-progress-root]) {
		height: 0.625rem;
	}

	:global(.progress-lg[data-progress-root]) {
		height: 1rem;
	}

	/* Indicator */
	.progress-indicator {
		height: 100%;
		border-radius: var(--radius-full);
		transition: width var(--duration-normal) ease;
	}

	/* Variant colors */
	.progress-default {
		background: var(--color-primary);
	}

	.progress-success {
		background: var(--color-success);
	}

	.progress-warning {
		background: var(--color-warning);
	}

	.progress-error {
		background: var(--color-error);
	}

	/* Indeterminate animation */
	.progress-indeterminate {
		width: 33.333% !important;
		animation: indeterminate 1.5s ease-in-out infinite;
	}

	@keyframes indeterminate {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(400%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.progress-indeterminate {
			animation-duration: 3s;
		}
	}

	/* Label */
	.progress-label {
		color: var(--color-muted);
		font-variant-numeric: tabular-nums;
	}

	.progress-label--sm {
		font-size: var(--text-fluid-xs);
	}

	.progress-label--md {
		font-size: var(--text-fluid-sm);
	}

	.progress-label--lg {
		font-size: var(--text-fluid-base);
	}
</style>
