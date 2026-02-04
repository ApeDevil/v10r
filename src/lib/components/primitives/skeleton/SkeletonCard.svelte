<script lang="ts">
	import Skeleton from './Skeleton.svelte';
	import SkeletonText from './SkeletonText.svelte';

	interface Props {
		hasImage?: boolean;
		hasTitle?: boolean;
		hasDescription?: boolean;
		class?: string;
	}

	let {
		hasImage = true,
		hasTitle = true,
		hasDescription = true,
		class: className
	}: Props = $props();
</script>

<div class="skeleton-card {className || ''}" role="status" aria-label="Loading card">
	{#if hasImage}
		<Skeleton height="200px" width="100%" rounded="lg" class="card-image" />
	{/if}

	<div class="card-content">
		{#if hasTitle}
			<Skeleton height="1.5rem" width="70%" rounded="sm" class="card-title" />
		{/if}

		{#if hasDescription}
			<SkeletonText lines={2} class="card-description" />
		{/if}
	</div>
</div>

<style>
	.skeleton-card {
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-4);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.card-content {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	:global(.skeleton-card .card-image) {
		margin: calc(-1 * var(--spacing-4)) calc(-1 * var(--spacing-4)) 0 calc(-1 * var(--spacing-4));
		width: calc(100% + var(--spacing-4) * 2);
		border-radius: var(--radius-lg) var(--radius-lg) 0 0;
	}
</style>
