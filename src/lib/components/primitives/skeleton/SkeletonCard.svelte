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
		border-radius: 0.5rem;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.card-content {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	:global(.skeleton-card .card-image) {
		margin: -1rem -1rem 0 -1rem;
		width: calc(100% + 2rem);
		border-radius: 0.5rem 0.5rem 0 0;
	}
</style>
