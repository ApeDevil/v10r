<script lang="ts">
	interface Props {
		class?: string;
		width?: string;
		height?: string;
		rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
	}

	let { class: className, width = '100%', height = '1rem', rounded = 'md' }: Props = $props();

	const roundedClass = $derived({
		none: '',
		sm: 'rounded-sm',
		md: 'rounded-md',
		lg: 'rounded-lg',
		full: 'rounded-full'
	}[rounded]);
</script>

<div
	class="skeleton {roundedClass} {className || ''}"
	style:width
	style:height
	role="status"
	aria-label="Loading"
></div>

<style>
	.skeleton {
		background: linear-gradient(
			90deg,
			var(--color-bg-secondary, #f3f4f6) 0%,
			var(--color-bg-tertiary, #e5e7eb) 50%,
			var(--color-bg-secondary, #f3f4f6) 100%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s ease-in-out infinite;
	}

	.rounded-sm {
		border-radius: 0.25rem;
	}

	.rounded-md {
		border-radius: 0.375rem;
	}

	.rounded-lg {
		border-radius: 0.5rem;
	}

	.rounded-full {
		border-radius: 9999px;
	}

	@keyframes shimmer {
		0% {
			background-position: -200% 0;
		}
		100% {
			background-position: 200% 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.skeleton {
			animation: none;
		}
	}
</style>
