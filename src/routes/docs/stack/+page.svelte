<script lang="ts">
	import { EmptyState } from '$lib/components/composites/empty-state';
</script>

<svelte:head>
	<title>Stack - Docs - Velociraptor</title>
</svelte:head>

<div class="page">
	<h1>Stack Documentation</h1>
	<p>Placeholder for technology stack documentation.</p>

	<EmptyState
		icon="i-lucide-settings"
		title="Coming Soon"
		description="Detailed documentation on SvelteKit, Drizzle, Better Auth, and the full stack."
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
