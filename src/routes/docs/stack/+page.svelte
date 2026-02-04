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
		max-width: var(--layout-narrow-width);
		margin: 0 auto;
		padding: var(--spacing-7) var(--spacing-4);
	}

	h1 {
		font-size: var(--text-fluid-3xl);
		margin-bottom: var(--spacing-4);
		color: var(--color-fg);
	}

	p {
		color: var(--color-muted);
		margin-bottom: var(--spacing-7);
	}

	.back-link {
		display: inline-block;
		margin-top: var(--spacing-7);
		color: var(--color-primary);
		text-decoration: none;
		font-weight: 600;
	}

	.back-link:hover {
		text-decoration: underline;
	}
</style>
