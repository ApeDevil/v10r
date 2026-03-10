<script lang="ts">
import { cn } from '$lib/utils/cn';
import { type SpinnerVariants, spinnerVariants } from './spinner';

interface Props extends SpinnerVariants {
	label?: string;
	class?: string;
}

let { size = 'md', variant = 'primary', label = 'Loading', class: className }: Props = $props();
</script>

<div
	role="status"
	aria-label={label}
	class={cn(spinnerVariants({ size, variant }), 'spinner', className)}
>
	<span class="sr-only">{label}</span>
</div>

<style>
	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation-duration: 0s !important;
			border-style: dotted;
		}
	}
</style>
