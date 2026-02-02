<script lang="ts">
	import { EmptyState } from '$lib/components/composites/empty-state';
</script>

<svelte:head>
	<title>Blueprint - Docs - Velociraptor</title>
</svelte:head>

<div class="page">
	<h1>Blueprint Documentation</h1>
	<p>Placeholder for application blueprint and architecture documentation.</p>

	<EmptyState
		icon="i-lucide-ruler"
		title="Coming Soon"
		description="Application shell blueprint, component architecture, and design patterns."
	/>

	<a href="/docs" class="back-link">← Back to Docs</a>
</div>

<style>
	.page {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	h1 {
		font-size: 2.5rem;
		margin-bottom: 1rem;
		color: var(--color-fg);
	}

	p {
		color: var(--color-muted);
		margin-bottom: 2rem;
	}

	.back-link {
		display: inline-block;
		margin-top: 2rem;
		color: var(--color-primary);
		text-decoration: none;
		font-weight: 600;
	}

	.back-link:hover {
		text-decoration: underline;
	}
</style>
