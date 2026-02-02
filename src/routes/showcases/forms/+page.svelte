<script lang="ts">
	import { EmptyState } from '$lib/components/composites/empty-state';
</script>

<svelte:head>
	<title>Forms - Showcases - Velociraptor</title>
</svelte:head>

<div class="page">
	<h1>Forms Showcase</h1>
	<p>Placeholder for form validation demonstrations with Valibot + Superforms.</p>

	<EmptyState
		icon="i-lucide-file-edit"
		title="Coming Soon"
		description="Interactive form examples with validation, error handling, and progressive enhancement."
	/>

	<a href="/showcases" class="back-link">← Back to Showcases</a>
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
