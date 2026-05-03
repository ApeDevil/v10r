<script lang="ts">
import * as m from '$lib/paraglide/messages';
import Skeleton from './Skeleton.svelte';

interface Props {
	lines?: number;
	width?: string;
	class?: string;
}

let { lines = 3, width, class: className }: Props = $props();

// Generate random widths for natural text appearance
// If width prop is provided and lines=1, use it directly
const lineWidths = $derived(
	width && lines === 1
		? [width]
		: Array.from({ length: lines }, (_, i) => {
				if (i === lines - 1) return width || `${60 + Math.random() * 20}%`; // Last line shorter
				return `${85 + Math.random() * 15}%`; // Other lines nearly full width
			}),
);
</script>

<div class="skeleton-text {className || ''}" role="status" aria-label={m.primitives_skeleton_text()}>
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
