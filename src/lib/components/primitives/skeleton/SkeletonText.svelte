<script lang="ts">
	import Skeleton from './Skeleton.svelte';

	interface Props {
		lines?: number;
		class?: string;
	}

	let { lines = 3, class: className }: Props = $props();

	// Generate random widths for natural text appearance
	const lineWidths = $derived(
		Array.from({ length: lines }, (_, i) => {
			if (i === lines - 1) return `${60 + Math.random() * 20}%`; // Last line shorter
			return `${85 + Math.random() * 15}%`; // Other lines nearly full width
		})
	);
</script>

<div class="skeleton-text {className || ''}" role="status" aria-label="Loading text">
	{#each lineWidths as width, i}
		<Skeleton height="1rem" {width} rounded="sm" class="text-line" />
	{/each}
</div>

<style>
	.skeleton-text {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}
</style>
